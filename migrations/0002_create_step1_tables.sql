-- Migration number: 0002
-- STEP1 のテーブル（仕様書 8.1 の7エンティティ）。設計は docs/db/ を参照。
--
-- 共通の決まり
-- - 日時はすべて UTC の文字列で、JS の Date#toISOString() と同じ形（例：2026-11-05T05:30:00.000Z）にそろえる。
--   形をそろえると、文字列のまま並べ替え・期間の比較ができる。
--   CHECK は「x IS strftime('%Y-%m-%dT%H:%M:%fZ', x, '+0 seconds')」で、日時として計算し直した値と一致することを確かめる。
--   - = ではなく IS で比べる：日時として読めない値（'abc' など）は strftime が NULL を返し、= だと CHECK を通ってしまうため。
--     IS なら NULL の列（削除されていない deleted_at など）は通り、読めない値は弾く
--   - '+0 seconds'：日時を計算し直させて、24:00 のような値（翌日の 00:00 になる）も弾くため
-- - 論理削除は deleted_at（削除日時。NULL なら削除されていない）。削除のときは updated_by・updated_at も記録する。
--   会社を削除するときは、所属する担当者に会社と同じ deleted_at を入れる（一緒に削除された担当者を見分けるため）。
-- - 文字数の CHECK は length()（文字数＝コードポイント数で数える）。エラーメッセージを出す入力チェックはアプリ側
--   （src/domain/）で行い、ここの CHECK は最後の守りとする。
-- - メールアドレスは大文字・小文字を区別せずに比べる（COLLATE NOCASE）。

-- 利用者（F-10。初回ログイン時に登録する。画面から編集・削除しない）。
-- 名前は宛先の表示名（255文字以内）の初期値になるので、同じ上限にする
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (email <> ''),
  name TEXT NOT NULL CHECK (name <> '' AND length(name) <= 255),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (created_at IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 seconds'))
);

-- 宛先（F-09）。利用者とはメールアドレスで照合する（まだログインしていない人も登録するため、users への外部キーにしない）。
-- 同じメールアドレスの宛先は1件のみ（削除済みを含む）。
-- エンジニアが DB に直接登録した宛先は、更新者・更新日時がない（docs/questions.md Q-M24。未決）
CREATE TABLE recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL CHECK (display_name <> '' AND length(display_name) <= 255),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (email <> ''),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (created_at IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 seconds')),
  updated_by INTEGER REFERENCES users (id),
  updated_at TEXT CHECK (updated_at IS strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 seconds')),
  deleted_at TEXT CHECK (deleted_at IS strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at, '+0 seconds')),
  CHECK ((updated_by IS NULL) = (updated_at IS NULL))
);

-- 会社（F-06）。同じ会社名を登録できる。会社名は任意（空は ''）、よみがなは必須
CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 255),
  kana TEXT NOT NULL CHECK (kana <> '' AND length(kana) <= 255),
  phone TEXT NOT NULL DEFAULT '' CHECK (phone NOT GLOB '*[^0-9]*' AND length(phone) <= 15),
  memo TEXT NOT NULL DEFAULT '' CHECK (length(memo) <= 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (created_at IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 seconds')),
  updated_by INTEGER NOT NULL REFERENCES users (id),
  updated_at TEXT NOT NULL CHECK (updated_at IS strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 seconds')),
  deleted_at TEXT CHECK (deleted_at IS strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at, '+0 seconds'))
);

-- 会社一覧（S-05）：削除されていない会社を、よみがな順（同じなら登録順）
CREATE INDEX companies_active_kana ON companies (kana, id) WHERE deleted_at IS NULL;

-- 担当者（F-07）。所属する会社は変えない（アプリの UPDATE で company_id を変えない）。
-- 担当者名は任意（空は ''）、よみがな・電話番号は必須。同じ電話番号の担当者を登録できる
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies (id),
  name TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 255),
  kana TEXT NOT NULL CHECK (kana <> '' AND length(kana) <= 255),
  phone TEXT NOT NULL CHECK (phone <> '' AND phone NOT GLOB '*[^0-9]*' AND length(phone) <= 15),
  memo TEXT NOT NULL DEFAULT '' CHECK (length(memo) <= 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (created_at IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 seconds')),
  updated_by INTEGER NOT NULL REFERENCES users (id),
  updated_at TEXT NOT NULL CHECK (updated_at IS strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 seconds')),
  deleted_at TEXT CHECK (deleted_at IS strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at, '+0 seconds'))
);

-- 会社の担当者一覧（S-06）・担当者数（S-05）・相手の検索（S-01）・会社の削除
CREATE INDEX contacts_active_company ON contacts (company_id, id) WHERE deleted_at IS NULL;
-- 取次メモの (contact_id, company_id) の外部キーの参照先（担当者と会社の組み合わせが正しいことを守る）
CREATE UNIQUE INDEX contacts_id_company ON contacts (id, company_id);

-- 取次可否（会社単位。F-08）。会社×宛先で1件。行がなければ「未設定」（更新者・更新日時なし）。
-- 一度保存したあとに「未設定」に戻したときは、行を残して value = 'unset' にする（更新者を記録するため）。
-- created_at は最初に保存した日時（UPSERT の更新では書かない）
CREATE TABLE company_settings (
  company_id INTEGER NOT NULL REFERENCES companies (id),
  recipient_id INTEGER NOT NULL REFERENCES recipients (id),
  value TEXT NOT NULL CHECK (value IN ('connect', 'decline', 'unset')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (created_at IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 seconds')),
  updated_by INTEGER NOT NULL REFERENCES users (id),
  updated_at TEXT NOT NULL CHECK (updated_at IS strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 seconds')),
  PRIMARY KEY (company_id, recipient_id)
);

-- 取次可否（担当者単位。F-08）。担当者×宛先で1件。決まりは会社単位と同じ
CREATE TABLE contact_settings (
  contact_id INTEGER NOT NULL REFERENCES contacts (id),
  recipient_id INTEGER NOT NULL REFERENCES recipients (id),
  value TEXT NOT NULL CHECK (value IN ('connect', 'decline', 'unset')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (created_at IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 seconds')),
  updated_by INTEGER NOT NULL REFERENCES users (id),
  updated_at TEXT NOT NULL CHECK (updated_at IS strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 seconds')),
  PRIMARY KEY (contact_id, recipient_id)
);

-- 取次メモ（F-02〜F-05）。会社名・氏名・電話番号は作成時の値を持つ（会社・担当者を後で編集しても変えない）。
-- 紐づく会社・担当者は任意（未登録の相手なら両方 NULL、会社だけの行から作成したら担当者が NULL）。
-- 作成者・作成日時は作成時のまま変えない（アプリの UPDATE で変えない）
CREATE TABLE memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL REFERENCES recipients (id),
  -- 受電日時（分単位）
  received_at TEXT NOT NULL
    CHECK (
      received_at IS strftime('%Y-%m-%dT%H:%M:%fZ', received_at, '+0 seconds')
      AND substr(received_at, 18, 6) = '00.000'
    ),
  company_name TEXT NOT NULL CHECK (company_name <> '' AND length(company_name) <= 255),
  person_name TEXT NOT NULL DEFAULT '' CHECK (length(person_name) <= 255),
  phone TEXT NOT NULL DEFAULT '' CHECK (phone NOT GLOB '*[^0-9]*' AND length(phone) <= 15),
  company_id INTEGER REFERENCES companies (id),
  contact_id INTEGER,
  -- 用件：callback（折り返し希望）／notify（連絡があったことをお伝え希望）／message（伝言希望）
  purpose TEXT NOT NULL CHECK (purpose IN ('callback', 'notify', 'message')),
  message TEXT NOT NULL DEFAULT '' CHECK (length(message) <= 1000),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  -- 状態：open（未対処）／done（対処済み）
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  done_by INTEGER REFERENCES users (id),
  done_at TEXT CHECK (done_at IS strftime('%Y-%m-%dT%H:%M:%fZ', done_at, '+0 seconds')),
  created_by INTEGER NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL CHECK (created_at IS strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+0 seconds')),
  updated_by INTEGER NOT NULL REFERENCES users (id),
  updated_at TEXT NOT NULL CHECK (updated_at IS strftime('%Y-%m-%dT%H:%M:%fZ', updated_at, '+0 seconds')),
  deleted_at TEXT CHECK (deleted_at IS strftime('%Y-%m-%dT%H:%M:%fZ', deleted_at, '+0 seconds')),
  -- 担当者を紐づけるなら、その担当者の会社も紐づける（どちらかが NULL なら外部キーは確かめない）
  FOREIGN KEY (contact_id, company_id) REFERENCES contacts (id, company_id),
  CHECK (contact_id IS NULL OR company_id IS NOT NULL),
  -- 折り返し希望なら電話番号は必須
  CHECK (purpose <> 'callback' OR phone <> ''),
  -- 対処済みなら対処済みにした人・日時がある。未対処ならない（未対処に戻したら消す）
  CHECK (
    (status = 'open' AND done_by IS NULL AND done_at IS NULL)
    OR (status = 'done' AND done_by IS NOT NULL AND done_at IS NOT NULL)
  )
);

-- 取次メモ一覧（S-02）：受電日時の新しい順（同じなら作成日時の新しい順、ID の大きい順）
CREATE INDEX memos_active_received ON memos (received_at DESC, created_at DESC, id DESC) WHERE deleted_at IS NULL;
-- 取次メモ一覧（S-02）：宛先・「自分宛て」で絞り込んだとき
CREATE INDEX memos_active_recipient_received ON memos (recipient_id, received_at DESC, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
