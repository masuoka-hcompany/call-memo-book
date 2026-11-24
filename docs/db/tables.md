# テーブル定義（STEP1）

方針は `docs/db/README.md`。SQL は `migrations/0002_create_step1_tables.sql`。

- 型は SQLite の型。日時はすべて TEXT（UTC、`2026-11-05T05:30:00.000Z` の形。README 1.2）
- 「必須」は NOT NULL かつ空文字でない、「任意」は NOT NULL で空文字 `''` を許す（NULL にしない）。空かどうかの判定と、部分一致の比較を単純にするため
- 文字数は `length()`（コードポイントの数）
- 「共通の列」：`created_at`（作成日時。省略時は現在時刻。ただし `memos` は既定値なしで、作成時にアプリが入れる）、`updated_by`（更新者。`users.id`）、`updated_at`（更新日時）、`deleted_at`（削除日時。NULL なら削除されていない）
- 日時の CHECK は `x IS strftime('%Y-%m-%dT%H:%M:%fZ', x, '+0 seconds')`（README 1.2）
- 「例」の値は説明のための架空のもの。名前は仕様書の AC に合わせ、メールアドレスは `@example.com` の仮の値にしている（`docs/questions.md` Q-M05）。日時の例の（ ）内は日本時間

## users（利用者）

| 列 | 型 | NULL | 制約・既定値 | 説明 | 例 |
|---|---|---|---|---|---|
| id | INTEGER | × | PK（AUTOINCREMENT） | | `1` |
| email | TEXT | × | UNIQUE、`COLLATE NOCASE`、空不可 | メールアドレス（Cloudflare Access の認証情報から取る） | `kikuchi@example.com` |
| name | TEXT | × | 空不可、255文字以内 | 名前（Google アカウントの表示名。取れなければメールアドレス。F-10）。宛先の表示名の初期値になるので、同じ上限にする（長ければアプリで切り詰める） | `菊地` |
| created_at | TEXT | × | 既定：現在時刻 | 初回ログインの日時 | `2026-11-20T00:15:00.000Z`（11/20 09:15） |

- 論理削除・更新者はない（画面から編集・削除しない。F-10）

## recipients（宛先）

| 列 | 型 | NULL | 制約・既定値 | 説明 | 例 |
|---|---|---|---|---|---|
| id | INTEGER | × | PK（AUTOINCREMENT） | | `1` |
| display_name | TEXT | × | 空不可、255文字以内 | 表示名（追加時は利用者の名前） | `菊地` |
| email | TEXT | × | UNIQUE（削除済みを含む）、`COLLATE NOCASE`、空不可 | 利用者との照合に使う。編集しない | `kikuchi@example.com` |
| created_at | TEXT | × | 既定：現在時刻 | | `2026-11-19T09:00:00.000Z`（11/19 18:00） |
| updated_by | INTEGER | ○ | FK → users.id | DB に直接登録した宛先は NULL（Q-M24） | `2`／DB に直接登録したままなら `NULL` |
| updated_at | TEXT | ○ | | `updated_by` と両方 NULL か、両方あるか（CHECK） | `2026-11-20T01:00:00.000Z`／`NULL` |
| deleted_at | TEXT | ○ | | | `NULL`（削除されていない）／`2026-11-25T03:00:00.000Z`（削除済み） |

- 削除した宛先の取次メモ・取次可否は残す（F-09）。画面のプルダウン・取次可否の表示には出さない
- 宛先の追加で、削除済みの宛先と同じメールアドレスは UNIQUE で弾かれる（F-09：削除した宛先は画面から再追加できない）

## companies（会社）

| 列 | 型 | NULL | 制約・既定値 | 説明 | 例 |
|---|---|---|---|---|---|
| id | INTEGER | × | PK（AUTOINCREMENT） | | `10` |
| name | TEXT | × | 255文字以内、既定 `''` | 会社名（任意。同じ会社名を登録できる） | `マイナビ`／会社名が空なら `''` |
| kana | TEXT | × | 空不可、255文字以内 | 会社名のよみがな（使える文字はアプリで確かめる。Q-M08） | `まいなび` |
| phone | TEXT | × | 半角数字のみ、15桁以内、既定 `''` | 電話番号（任意。使い方は仕様書 Q-12 で未決） | `0312345678`／`''` |
| memo | TEXT | × | 1,000文字以内、既定 `''` | メモ | `代表番号から転送されてくることが多い`／`''` |
| created_at | TEXT | × | 既定：現在時刻 | | `2026-11-20T02:00:00.000Z`（11/20 11:00） |
| updated_by | INTEGER | × | FK → users.id | | `1` |
| updated_at | TEXT | × | | | `2026-11-21T04:30:00.000Z`（11/21 13:30） |
| deleted_at | TEXT | ○ | | | `NULL`／`2026-11-25T03:00:00.000Z` |

インデックス
- `companies_active_kana (kana, id) WHERE deleted_at IS NULL`：会社一覧（S-05）のよみがな順。SQLite の既定の比較（BINARY）は UTF-8 のバイト順＝コードポイント順なので、モックの並び（Q-M14）と同じになる

## contacts（担当者）

| 列 | 型 | NULL | 制約・既定値 | 説明 | 例 |
|---|---|---|---|---|---|
| id | INTEGER | × | PK（AUTOINCREMENT） | | `20` |
| company_id | INTEGER | × | FK → companies.id | 所属する会社（変えない） | `10` |
| name | TEXT | × | 255文字以内、既定 `''` | 担当者名（任意） | `原田`／担当者名が空なら `''` |
| kana | TEXT | × | 空不可、255文字以内 | 担当者名のよみがな | `はらだ` |
| phone | TEXT | × | 空不可、半角数字のみ、15桁以内 | 電話番号（必須。同じ番号の担当者を登録できる。AC-61） | `09012345678` |
| memo | TEXT | × | 1,000文字以内、既定 `''` | メモ | `営業部`／`''` |
| created_at | TEXT | × | 既定：現在時刻 | | `2026-11-20T02:05:00.000Z` |
| updated_by | INTEGER | × | FK → users.id | | `1` |
| updated_at | TEXT | × | | | `2026-11-20T02:05:00.000Z` |
| deleted_at | TEXT | ○ | | 会社と一緒に削除したときは、会社と同じ値 | `NULL`／会社と一緒に削除したら会社と同じ `2026-11-25T03:00:00.000Z` |

インデックス
- `contacts_active_company (company_id, id) WHERE deleted_at IS NULL`：会社の担当者一覧（S-06。登録順）、担当者数（S-05）、相手の検索（S-01）、会社の削除
- `contacts_id_company UNIQUE (id, company_id)`：取次メモの複合外部キーの参照先

## company_settings（取次可否・会社単位）

| 列 | 型 | NULL | 制約・既定値 | 説明 | 例 |
|---|---|---|---|---|---|
| company_id | INTEGER | × | PK、FK → companies.id | | `10` |
| recipient_id | INTEGER | × | PK、FK → recipients.id | | `1` |
| value | TEXT | × | `connect` / `decline` / `unset` | 取次可否 | `decline`（つながない） |
| created_at | TEXT | × | 既定：現在時刻 | 最初に保存した日時（更新では変えない） | `2026-11-20T03:00:00.000Z`（11/20 12:00） |
| updated_by | INTEGER | × | FK → users.id | | `2` |
| updated_at | TEXT | × | | | `2026-11-21T05:00:00.000Z`（11/21 14:00） |

- 会社×宛先で1行（主キー）。行がなければ「未設定」で、更新者・更新日時はない（Q-M19）
- 一度保存したあとに「未設定」に戻したときは、行を消さずに `unset` にする（戻した人を更新者として残す）
- 論理削除しない。会社・宛先が削除されても行は残し、表示するときに削除された宛先を除く

## contact_settings（取次可否・担当者単位）

`company_settings` の `company_id` を `contact_id`（FK → contacts.id）にしたもの。決まりは同じ。

| 列 | 例 |
|---|---|
| contact_id | `20` |
| recipient_id | `1` |
| value | `connect`（つなぐ） |
| created_at | `2026-11-21T05:01:00.000Z` |
| updated_by | `2` |
| updated_at | `2026-11-21T05:01:00.000Z` |

- 優先ルール（担当者が `unset` 以外なら担当者、`unset` なら会社）はアプリ（`src/domain/`）で判定する。上の例では、宛先 `1` に対して会社は `decline`、担当者は `connect` なので、担当者の `connect`（つなぐ）を採用する。取る SQL は `docs/db/queries.md` 2.2

## memos（取次メモ）

| 列 | 型 | NULL | 制約・既定値 | 説明 | 例 |
|---|---|---|---|---|---|
| id | INTEGER | × | PK（AUTOINCREMENT） | | `100` |
| recipient_id | INTEGER | × | FK → recipients.id | 宛先 | `1` |
| received_at | TEXT | × | 秒以下は `00.000`（分単位） | 受電日時 | `2026-11-24T05:30:00.000Z`（11/24 14:30） |
| company_name | TEXT | × | 空不可、255文字以内 | 会社名（作成時の値） | `マイナビ` |
| person_name | TEXT | × | 255文字以内、既定 `''` | 氏名（作成時の値） | `原田`／`''` |
| phone | TEXT | × | 半角数字のみ、15桁以内、既定 `''` | 電話番号（作成時の値） | `09012345678`／`''` |
| company_id | INTEGER | ○ | FK → companies.id | 紐づく会社（未登録の相手なら NULL） | `10`／未登録の相手なら `NULL` |
| contact_id | INTEGER | ○ | (contact_id, company_id) → contacts(id, company_id) | 紐づく担当者（会社だけの行・未登録の相手なら NULL） | `20`／`NULL` |
| purpose | TEXT | × | `callback` / `notify` / `message` | 用件 | `callback`（折り返し希望） |
| message | TEXT | × | 1,000文字以内、既定 `''` | 伝言（改行は LF） | `明日の午前中に折り返しをお願いします`／`''` |
| note | TEXT | × | 1,000文字以内、既定 `''` | メモ（改行は LF） | `急ぎではないとのこと`／`''` |
| status | TEXT | × | `open` / `done`、既定 `open` | 状態 | `open`（未対処）／`done`（対処済み） |
| done_by | INTEGER | ○ | FK → users.id | 対処済みにした人 | 未対処なら `NULL`／対処済みなら `1` |
| done_at | TEXT | ○ | | 対処済みにした日時 | 未対処なら `NULL`／`2026-11-24T07:10:00.000Z` |
| created_by | INTEGER | × | FK → users.id | 作成者（変えない） | `3` |
| created_at | TEXT | × | | 作成日時（変えない。既定値なし：作成時にアプリが入れる） | `2026-11-24T05:32:41.123Z` |
| updated_by | INTEGER | × | FK → users.id | | `3` |
| updated_at | TEXT | × | | | `2026-11-24T05:32:41.123Z` |
| deleted_at | TEXT | ○ | | | `NULL`／`2026-11-25T00:00:00.000Z` |

- 受電日時は分単位（入力した値）なので秒以下が `00.000` になる。作成日時・更新日時などは保存した時刻なので、秒・ミリ秒まで入る

表の CHECK
- `contact_id IS NULL OR company_id IS NOT NULL`：担当者を紐づけるなら会社も紐づける
- 複合外部キー `(contact_id, company_id) → contacts (id, company_id)`：紐づく担当者がその会社の担当者であること。どちらかが NULL なら確かめない
- `purpose <> 'callback' OR phone <> ''`：折り返し希望なら電話番号は必須
- `status = 'open'` なら `done_by`・`done_at` が NULL、`status = 'done'` なら両方ある（未対処に戻したら消す。F-05）

紐づけの組み合わせの例

| 作成のしかた（F-02） | company_id | contact_id |
|---|---|---|
| S-01 で担当者の行を選んで作成 | `10` | `20` |
| S-01 で会社だけの行（担当者0人の会社）を選んで作成 | `10` | `NULL` |
| 未登録の相手（S-01 で0件のとき・一覧から作成） | `NULL` | `NULL` |

インデックス
- `memos_active_received (received_at DESC, created_at DESC, id DESC) WHERE deleted_at IS NULL`：取次メモ一覧（S-02）の並び（受電日時の新しい順。同じなら作成日時・ID の新しい順。Q-M32 のモックの形）
- `memos_active_recipient_received (recipient_id, received_at DESC, created_at DESC, id DESC) WHERE deleted_at IS NULL`：宛先・「自分宛て」で絞り込んだとき
- 状態（2値）だけのインデックスは作らない。キーワードの部分一致はインデックスを使えない（README 1.6）
- `company_id`・`contact_id` にはインデックスを作らない。これで取る画面がなく（Q-M34：詳細に紐づけを出さない）、親の行を物理削除しないため

- 一覧（S-02）の中身は実装の判断に任せる（仕様書 F-03 備考）。並び順を変えるなら、インデックスもあわせて直す
