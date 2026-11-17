# テーブル定義（STEP1）

方針は `docs/db/README.md`。SQL は `migrations/0002_create_step1_tables.sql`。

- 型は SQLite の型。日時はすべて TEXT（UTC、`2026-11-05T05:30:00.000Z` の形。README 1.2）
- 「必須」は NOT NULL かつ空文字でない、「任意」は NOT NULL で空文字 `''` を許す（NULL にしない）。空かどうかの判定と、部分一致の比較を単純にするため
- 文字数は `length()`（コードポイントの数）
- 「共通の列」：`created_at`（作成日時。省略時は現在時刻）、`updated_by`（更新者。`users.id`）、`updated_at`（更新日時）、`deleted_at`（削除日時。NULL なら削除されていない）

## users（利用者）

| 列 | 型 | NULL | 制約・既定値 | 説明 |
|---|---|---|---|---|
| id | INTEGER | × | PK（AUTOINCREMENT） | |
| email | TEXT | × | UNIQUE、`COLLATE NOCASE`、空不可 | メールアドレス（Cloudflare Access の認証情報から取る） |
| name | TEXT | × | 空不可 | 名前（Google アカウントの表示名。取れなければメールアドレス。F-10） |
| created_at | TEXT | × | 既定：現在時刻 | 初回ログインの日時 |

- 論理削除・更新者はない（画面から編集・削除しない。F-10）

## recipients（宛先）

| 列 | 型 | NULL | 制約・既定値 | 説明 |
|---|---|---|---|---|
| id | INTEGER | × | PK（AUTOINCREMENT） | |
| display_name | TEXT | × | 空不可、255文字以内 | 表示名（追加時は利用者の名前） |
| email | TEXT | × | UNIQUE（削除済みを含む）、`COLLATE NOCASE`、空不可 | 利用者との照合に使う。編集しない |
| created_at | TEXT | × | 既定：現在時刻 | |
| updated_by | INTEGER | ○ | FK → users.id | DB に直接登録した宛先は NULL（Q-M24） |
| updated_at | TEXT | ○ | | `updated_by` と両方 NULL か、両方あるか（CHECK） |
| deleted_at | TEXT | ○ | | |

- 削除した宛先の取次メモ・取次可否は残す（F-09）。画面のプルダウン・取次可否の表示には出さない
- 宛先の追加で、削除済みの宛先と同じメールアドレスは UNIQUE で弾かれる（F-09：削除した宛先は画面から再追加できない）

## companies（会社）

| 列 | 型 | NULL | 制約・既定値 | 説明 |
|---|---|---|---|---|
| id | INTEGER | × | PK（AUTOINCREMENT） | |
| name | TEXT | × | 255文字以内、既定 `''` | 会社名（任意。同じ会社名を登録できる） |
| kana | TEXT | × | 空不可、255文字以内 | 会社名のよみがな（使える文字はアプリで確かめる。Q-M08） |
| phone | TEXT | × | 半角数字のみ、15桁以内、既定 `''` | 電話番号（任意。使い方は仕様書 Q-12 で未決） |
| memo | TEXT | × | 1,000文字以内、既定 `''` | メモ |
| created_at・updated_by・updated_at・deleted_at | | | 共通の列（`updated_by`・`updated_at` は NOT NULL） | |

インデックス
- `companies_active_kana (kana, id) WHERE deleted_at IS NULL`：会社一覧（S-05）のよみがな順。SQLite の既定の比較（BINARY）は UTF-8 のバイト順＝コードポイント順なので、モックの並び（Q-M14）と同じになる

## contacts（担当者）

| 列 | 型 | NULL | 制約・既定値 | 説明 |
|---|---|---|---|---|
| id | INTEGER | × | PK（AUTOINCREMENT） | |
| company_id | INTEGER | × | FK → companies.id | 所属する会社（変えない） |
| name | TEXT | × | 255文字以内、既定 `''` | 担当者名（任意） |
| kana | TEXT | × | 空不可、255文字以内 | 担当者名のよみがな |
| phone | TEXT | × | 空不可、半角数字のみ、15桁以内 | 電話番号（必須。同じ番号の担当者を登録できる。AC-61） |
| memo | TEXT | × | 1,000文字以内、既定 `''` | メモ |
| created_at・updated_by・updated_at・deleted_at | | | 共通の列（`updated_by`・`updated_at` は NOT NULL） | 会社と一緒に削除したときは、`deleted_at` が会社と同じ値 |

インデックス
- `contacts_active_company (company_id, id) WHERE deleted_at IS NULL`：会社の担当者一覧（S-06。登録順）、担当者数（S-05）、相手の検索（S-01）、会社の削除
- `contacts_id_company UNIQUE (id, company_id)`：取次メモの複合外部キーの参照先

## company_settings（取次可否・会社単位）

| 列 | 型 | NULL | 制約・既定値 | 説明 |
|---|---|---|---|---|
| company_id | INTEGER | × | PK、FK → companies.id | |
| recipient_id | INTEGER | × | PK、FK → recipients.id | |
| value | TEXT | × | `connect` / `decline` / `unset` | 取次可否 |
| updated_by | INTEGER | × | FK → users.id | |
| updated_at | TEXT | × | | |

- 会社×宛先で1行（主キー）。行がなければ「未設定」で、更新者・更新日時はない（Q-M19）
- 一度保存したあとに「未設定」に戻したときは、行を消さずに `unset` にする（戻した人を更新者として残す）
- 論理削除しない。会社・宛先が削除されても行は残し、表示するときに削除された宛先を除く

## contact_settings（取次可否・担当者単位）

`company_settings` の `company_id` を `contact_id`（FK → contacts.id）にしたもの。決まりは同じ。

- 優先ルール（担当者が `unset` 以外なら担当者、`unset` なら会社）はアプリ（`src/domain/`）で判定する。取る SQL は `docs/db/queries.md` 2.2

## memos（取次メモ）

| 列 | 型 | NULL | 制約・既定値 | 説明 |
|---|---|---|---|---|
| id | INTEGER | × | PK（AUTOINCREMENT） | |
| recipient_id | INTEGER | × | FK → recipients.id | 宛先 |
| received_at | TEXT | × | 秒以下は `00.000`（分単位） | 受電日時 |
| company_name | TEXT | × | 空不可、255文字以内 | 会社名（作成時の値） |
| person_name | TEXT | × | 255文字以内、既定 `''` | 氏名（作成時の値） |
| phone | TEXT | × | 半角数字のみ、15桁以内、既定 `''` | 電話番号（作成時の値） |
| company_id | INTEGER | ○ | FK → companies.id | 紐づく会社（未登録の相手なら NULL） |
| contact_id | INTEGER | ○ | (contact_id, company_id) → contacts(id, company_id) | 紐づく担当者（会社だけの行・未登録の相手なら NULL） |
| purpose | TEXT | × | `callback` / `notify` / `message` | 用件 |
| message | TEXT | × | 1,000文字以内、既定 `''` | 伝言（改行は LF） |
| note | TEXT | × | 1,000文字以内、既定 `''` | メモ（改行は LF） |
| status | TEXT | × | `open` / `done`、既定 `open` | 状態 |
| done_by | INTEGER | ○ | FK → users.id | 対処済みにした人 |
| done_at | TEXT | ○ | | 対処済みにした日時 |
| created_by | INTEGER | × | FK → users.id | 作成者（変えない） |
| created_at | TEXT | × | | 作成日時（変えない。既定値なし：作成時にアプリが入れる） |
| updated_by・updated_at・deleted_at | | | 共通の列（`updated_by`・`updated_at` は NOT NULL） | |

表の CHECK
- `contact_id IS NULL OR company_id IS NOT NULL`：担当者を紐づけるなら会社も紐づける
- 複合外部キー `(contact_id, company_id) → contacts (id, company_id)`：紐づく担当者がその会社の担当者であること。どちらかが NULL なら確かめない
- `purpose <> 'callback' OR phone <> ''`：折り返し希望なら電話番号は必須
- `status = 'open'` なら `done_by`・`done_at` が NULL、`status = 'done'` なら両方ある（未対処に戻したら消す。F-05）

インデックス
- `memos_active_received (received_at DESC, created_at DESC, id DESC) WHERE deleted_at IS NULL`：取次メモ一覧（S-02）の並び（受電日時の新しい順。同じなら作成日時・ID の新しい順。Q-M32 のモックの形）
- `memos_active_recipient_received (recipient_id, received_at DESC, created_at DESC, id DESC) WHERE deleted_at IS NULL`：宛先・「自分宛て」で絞り込んだとき
- 状態（2値）だけのインデックスは作らない。キーワードの部分一致はインデックスを使えない（README 1.6）
- `company_id`・`contact_id` にはインデックスを作らない。これで取る画面がなく（Q-M34：詳細に紐づけを出さない）、親の行を物理削除しないため

- 一覧（S-02）の中身は実装の判断に任せる（仕様書 F-03 備考）。並び順を変えるなら、インデックスもあわせて直す
