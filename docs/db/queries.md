# 取り方・更新のしかた（STEP1）

画面が必要とする SQL の形。本実装の `src/repo/` はこれをもとに書く。インデックスはこの形に合わせてある（`docs/db/tables.md`）。

- `?1`・`?2` … はバインドする値。日時は UTC の `toISOString()` の形で渡す
- `?by`（更新者＝ログイン中の利用者の ID）・`?now`（その処理の現在時刻）・`?k`（キーワード）は、読みやすくするための説明用の書き方で、このままでは動かない。実装では `?` か `?NNN`（番号つき）にする
- 削除されていない行だけを取るときは `deleted_at IS NULL` をそのまま書く（部分インデックスを使わせるため）
- 名前が空の会社・担当者によみがなを出すこと、優先ルール、区分の画面の表記は、アプリで行う
- 「（仮）」と書いたものは、モックの仮の形に合わせたもの（`docs/questions.md`）

## 1. 共通

### 1.1 ログイン中の利用者（F-10）
リクエストのたびに、Cloudflare Access の認証情報のメールアドレスで取る。なければ登録してから取り直す。

```sql
-- 1. 取る（ほとんどのリクエストはこれだけで済む）
SELECT id, email, name FROM users WHERE email = ?1;

-- 2. 1. で行がなかったときだけ登録し、1. を流し直す
--    （同時に初回ログインが来ても、片方は DO NOTHING になる）
INSERT INTO users (email, name) VALUES (?1, ?2)
ON CONFLICT (email) DO NOTHING;
```

- いきなり `INSERT … ON CONFLICT DO NOTHING` を流さない。登録済みでも `AUTOINCREMENT` の連番（`sqlite_sequence`）が進むため、すべてのリクエストが書き込みになり、利用者の ID もリクエストの数だけ飛ぶ
- 名前は255文字以内（`users.name` の CHECK。宛先の表示名の初期値になるため）。Google アカウントの表示名が長いときは、アプリで255文字に切り詰めてから登録する

### 1.2 「自分宛て」の宛先
ログイン中の利用者と同じメールアドレスの宛先。削除された宛先も含める（その宛先の取次メモは「自分宛て」に含める。Q-M30 の仮の形）。
`recipients.email` は削除済みを含めて一意なので、高々1件。

```sql
SELECT id FROM recipients WHERE email = ?1;  -- ?1：ログイン中の利用者のメールアドレス
```

- 行がなければ、ログイン中の利用者は宛先ではない。「自分宛て」で絞り込んだときは、取次メモの SQL を流さずに0件とする

## 2. 読み取り

### 2.1 相手の検索（S-01・F-01）
会社名・会社名のよみがな・担当者名・担当者名のよみがな・電話番号に部分一致する相手。担当者ごとに1行で、担当者がいない会社は会社だけの行（`contact_id` が NULL）。
会社が一致した場合はその会社の担当者全員が出る。担当者だけが一致した場合はその担当者だけが出る。

```sql
SELECT c.id AS company_id, c.name AS company_name, c.kana AS company_kana,
       p.id AS contact_id, p.name AS contact_name, p.kana AS contact_kana, p.phone
FROM companies c
LEFT JOIN contacts p ON p.company_id = c.id AND p.deleted_at IS NULL
WHERE c.deleted_at IS NULL
  AND (instr(c.name, ?1) > 0 OR instr(c.kana, ?1) > 0
       OR instr(p.name, ?1) > 0 OR instr(p.kana, ?1) > 0 OR instr(p.phone, ?1) > 0)
ORDER BY c.kana, c.id, p.id;  -- 並び順は指定なし（F-01）。モックと同じ並びにしている
```

- 検索欄が空（空白だけを含む。Q-M26）のときは、SQL を流さない
- 担当者が0人の会社は `p` がすべて NULL になり、`instr(NULL, ?)` は NULL（偽）なので、会社が一致したときだけ出る
- 会社の電話番号を検索の対象にするか（仕様書 Q-12）が決まったら、`OR instr(c.phone, ?1) > 0` を足す

### 2.2 宛先ごとの取次可否（S-01 で相手を選んだあと）
削除されていない宛先ごとに、会社と担当者の取次可否を並べて取る。行がなければ「未設定」。

```sql
SELECT r.id, r.display_name,
       coalesce(cs.value, 'unset') AS company_value,
       coalesce(ps.value, 'unset') AS contact_value
FROM recipients r
LEFT JOIN company_settings cs ON cs.recipient_id = r.id AND cs.company_id = ?1
LEFT JOIN contact_settings ps ON ps.recipient_id = r.id AND ps.contact_id = ?2  -- 会社だけの行なら ?2 は NULL
WHERE r.deleted_at IS NULL
ORDER BY r.id;  -- 宛先の登録順（仮。Q-M23）
```

### 2.3 取次メモ一覧（S-02・F-03）
絞り込みの条件は、指定されたものだけを WHERE に足して組み立てる（`(?1 IS NULL OR …)` の形にすると、インデックスを使えなくなるため）。
件数と1ページ分は `db.batch()` で一緒に取る。

```sql
-- 1ページ分（1ページ50件）
SELECT m.id, m.received_at, r.display_name AS recipient_name, m.company_name, m.person_name,
       m.purpose, m.status, u.name AS created_by_name
FROM memos m
JOIN recipients r ON r.id = m.recipient_id      -- 削除された宛先の表示名も出す（Q-M30 の仮の形）
JOIN users u ON u.id = m.created_by
WHERE m.deleted_at IS NULL
  /* 宛先を選んだとき */      AND m.recipient_id = ?
  /* 「自分宛て」のとき */    AND m.recipient_id = ?   -- 1.2 で取った宛先の ID
  /* 状態 */                  AND m.status = ?
  /* 期間の始まり */          AND m.received_at >= ?   -- 始まりの日の 0:00（日本時間）を UTC にした値
  /* 期間の終わり */          AND m.received_at < ?    -- 終わりの日の翌日 0:00（日本時間）を UTC にした値
  /* キーワード */            AND (instr(m.company_name, ?k) > 0 OR instr(m.person_name, ?k) > 0
                                   OR instr(m.phone, ?k) > 0 OR instr(m.message, ?k) > 0 OR instr(m.note, ?k) > 0)
ORDER BY m.received_at DESC, m.created_at DESC, m.id DESC
LIMIT 50 OFFSET ?;  -- (ページ番号 - 1) × 50

-- 件数（ページの数と、0件の表示の出し分けに使う）
SELECT count(*) FROM memos m WHERE m.deleted_at IS NULL /* 上と同じ条件 */;
```

- 「自分宛て」を `IN (SELECT id FROM recipients WHERE email = ?)` と書くと、宛先が複数ありうる形になり、並べ替えに一時 B-tree を使ってしまう。1.2 で取った ID を `=` で渡す
- 「取次メモはまだありません」と「条件に一致する取次メモはありません」を出し分けるには、条件なしの件数も要る（条件があって0件のときだけ `SELECT EXISTS (SELECT 1 FROM memos WHERE deleted_at IS NULL)` を流せばよい）
- 一覧の中身は実装の判断に任せる（仕様書 F-03 備考）。ここはモックの形の例

### 2.4 取次メモ詳細（S-03）・編集（S-04）

```sql
SELECT m.*, r.display_name AS recipient_name, r.deleted_at AS recipient_deleted_at, u.name AS created_by_name
FROM memos m
JOIN recipients r ON r.id = m.recipient_id
JOIN users u ON u.id = m.created_by
WHERE m.id = ?1 AND m.deleted_at IS NULL;
```

- 宛先が削除されている取次メモを編集するとき、宛先は未選択で開く（Q-M28 の仮の形）。そのために `recipient_deleted_at` を取る

### 2.5 取次メモ作成（S-04）の自動入力・宛先のプルダウン

```sql
-- 相手を選んで開いたとき（担当者の行）
SELECT c.id AS company_id, c.name AS company_name, c.kana AS company_kana,
       p.id AS contact_id, p.name AS contact_name, p.kana AS contact_kana, p.phone
FROM contacts p JOIN companies c ON c.id = p.company_id
WHERE p.id = ?1 AND p.deleted_at IS NULL AND c.deleted_at IS NULL;

-- 相手を選んで開いたとき（会社だけの行。担当者0人の会社）
SELECT id AS company_id, name AS company_name, kana AS company_kana
FROM companies
WHERE id = ?1 AND deleted_at IS NULL;
-- 会社だけの行のとき、氏名・電話番号は空で開く。会社の電話番号を自動で入れるかは未決（仕様書 Q-12）

-- 宛先のプルダウン（削除された宛先は出さない）
SELECT id, display_name FROM recipients WHERE deleted_at IS NULL ORDER BY id;
```

### 2.6 会社一覧（S-05・F-06）

```sql
SELECT c.id, c.name, c.kana,
       (SELECT count(*) FROM contacts p WHERE p.company_id = c.id AND p.deleted_at IS NULL) AS contact_count
FROM companies c
WHERE c.deleted_at IS NULL
  /* 検索欄に入力があるとき */ AND (instr(c.name, ?1) > 0 OR instr(c.kana, ?1) > 0)
ORDER BY c.kana, c.id;  -- よみがな順。同じなら登録順（仮。Q-M14）
```

### 2.7 会社詳細（S-06）・担当者詳細（S-08）

```sql
-- 会社の情報と更新者
SELECT c.*, u.name AS updated_by_name
FROM companies c JOIN users u ON u.id = c.updated_by
WHERE c.id = ?1 AND c.deleted_at IS NULL;

-- 担当者一覧（登録順。仮。Q-M18）
SELECT id, name, kana, phone FROM contacts
WHERE company_id = ?1 AND deleted_at IS NULL
ORDER BY id;

-- 担当者の情報と更新者、所属する会社（S-08。会社名を出してリンクにするのは Q-M22 の仮の形）
SELECT p.*, u.name AS updated_by_name,
       c.name AS company_name, c.kana AS company_kana
FROM contacts p
JOIN users u ON u.id = p.updated_by
JOIN companies c ON c.id = p.company_id
WHERE p.id = ?1 AND p.deleted_at IS NULL AND c.deleted_at IS NULL;

-- 宛先ごとの取次可否と更新者（担当者単位は contact_settings / contact_id に置き換える）
SELECT r.id AS recipient_id, r.display_name,
       coalesce(s.value, 'unset') AS value, u.name AS updated_by_name, s.updated_at
FROM recipients r
LEFT JOIN company_settings s ON s.recipient_id = r.id AND s.company_id = ?1
LEFT JOIN users u ON u.id = s.updated_by
WHERE r.deleted_at IS NULL
ORDER BY r.id;
```

### 2.8 宛先一覧（S-10）・宛先追加のプルダウン（S-11）

```sql
-- 宛先一覧（更新者がいない宛先がある。Q-M24）
SELECT r.id, r.display_name, r.email, u.name AS updated_by_name, r.updated_at
FROM recipients r LEFT JOIN users u ON u.id = r.updated_by
WHERE r.deleted_at IS NULL
ORDER BY r.id;  -- 登録順（仮。Q-M23）

-- 追加できる利用者：宛先になっていない利用者（削除された宛先の利用者も出さない。F-09）
SELECT u.id, u.name FROM users u
WHERE NOT EXISTS (SELECT 1 FROM recipients r WHERE r.email = u.email)
ORDER BY u.id;
```

## 3. 書き込み
更新者 `?by` はログイン中の利用者、`?now` はその処理の現在時刻（UTC）。1つの処理の中では同じ `?now` を使う。

### 3.1 会社の登録・編集（S-07・F-06）

```sql
INSERT INTO companies (name, kana, phone, memo, created_at, updated_by, updated_at)
VALUES (?1, ?2, ?3, ?4, ?now, ?by, ?now)
RETURNING id;

UPDATE companies SET name = ?2, kana = ?3, phone = ?4, memo = ?5, updated_by = ?by, updated_at = ?now
WHERE id = ?1 AND deleted_at IS NULL;  -- 変わった行が0なら、削除済み・存在しない会社
```

### 3.2 担当者の登録・編集・削除（S-09・S-08・F-07）

```sql
-- 登録：会社が削除されていないときだけ入れる（会社の削除と同時に来たときに、削除済みの会社に担当者が増えないように）
INSERT INTO contacts (company_id, name, kana, phone, memo, created_at, updated_by, updated_at)
SELECT ?1, ?2, ?3, ?4, ?5, ?now, ?by, ?now
WHERE EXISTS (SELECT 1 FROM companies WHERE id = ?1 AND deleted_at IS NULL)
RETURNING id;

-- 編集：company_id は書かない（所属する会社は変えない）
UPDATE contacts SET name = ?2, kana = ?3, phone = ?4, memo = ?5, updated_by = ?by, updated_at = ?now
WHERE id = ?1 AND deleted_at IS NULL;

-- 削除（論理削除）。担当者単位の取次可否・紐づく取次メモはそのまま
UPDATE contacts SET deleted_at = ?now, updated_by = ?by, updated_at = ?now
WHERE id = ?1 AND deleted_at IS NULL;
```

### 3.3 会社の削除（S-06・F-06）
所属する担当者に、会社と同じ削除日時を入れる。2つの文を `db.batch()` で1つにまとめ、担当者を先に流す（会社が削除されていないことを担当者の文で確かめるため）。

```sql
UPDATE contacts SET deleted_at = ?now, updated_by = ?by, updated_at = ?now
WHERE company_id = ?1 AND deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM companies WHERE id = ?1 AND deleted_at IS NULL);

UPDATE companies SET deleted_at = ?now, updated_by = ?by, updated_at = ?now
WHERE id = ?1 AND deleted_at IS NULL;  -- 変わった行が0なら、削除済み・存在しない会社
```

- 既に個別に削除されていた担当者は `deleted_at IS NULL` に当たらないので、削除日時はそのまま（会社と違う値）になる
- 紐づく取次メモ・取次可否はそのまま残す

### 3.4 取次可否の保存（S-06・S-08・F-08）
**利用者が画面で変えた宛先だけ**を記録する（Q-M17 の仮の形）。宛先の分を `db.batch()` でまとめる。

- 画面を開いたときの値を、宛先ごとに hidden で一緒に送る。送られた値が開いたときの値と違う宛先だけを保存する
  - モック（`src/domain/setting.ts` の `settingChanges`）は、保存した時点の DB の値と比べていた。この形だと、次の流れで、A が触っていない宛先が巻き戻る：A が画面を開く（菊地＝つなぐ）→ B が菊地を「つながない」に変える → A が社長だけ変えて保存 → 菊地が「つなぐ」に戻り、A が更新者になる
  - 開いたときの値と比べれば、A が触っていない菊地は送られないので、B の変更が残る。2人が同じ宛先を変えたときは、あとから保存した方の値になる
- SQL でも、同じ値での上書き（更新者だけが変わること）を防ぐ（`WHERE company_settings.value <> excluded.value`）
- 会社・宛先が削除されていないときだけ保存する（画面を開いている間に削除されたとき、削除済みの会社・宛先に行を作らない）
- `created_at` は最初に保存した日時。更新では書かない

```sql
INSERT INTO company_settings (company_id, recipient_id, value, created_at, updated_by, updated_at)
SELECT ?1, ?2, ?3, ?now, ?by, ?now
WHERE EXISTS (SELECT 1 FROM companies WHERE id = ?1 AND deleted_at IS NULL)
  AND EXISTS (SELECT 1 FROM recipients WHERE id = ?2 AND deleted_at IS NULL)
ON CONFLICT (company_id, recipient_id) DO UPDATE
  SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  WHERE company_settings.value <> excluded.value;
-- 担当者単位は contact_settings / contact_id、存在の確かめは contacts にする
```

- 行がないときに「未設定」を送られた場合は、アプリが変化なしとみなして SQL を流さない（行がない＝未設定のまま）

### 3.5 取次メモの作成・編集・削除（S-04・S-03・F-02・F-04）

```sql
-- 作成：作成者＝更新者、作成日時＝更新日時、状態は未対処。
-- 宛先が削除されていないときだけ入れる（画面を開いている間に宛先が削除されたとき、削除済みの宛先宛てのメモを作らない）
INSERT INTO memos (recipient_id, received_at, company_name, person_name, phone, company_id, contact_id,
                   purpose, message, note, status, created_by, created_at, updated_by, updated_at)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'open', ?by, ?now, ?by, ?now
WHERE EXISTS (SELECT 1 FROM recipients WHERE id = ?1 AND deleted_at IS NULL)
RETURNING id;  -- 0行なら「宛先は必須です」（Q-M28 の仮の形）

-- 編集：作成者・作成日時・状態・紐づく会社と担当者は書かない。宛先が削除されていないときだけ
UPDATE memos SET recipient_id = ?2, received_at = ?3, company_name = ?4, person_name = ?5, phone = ?6,
                 purpose = ?7, message = ?8, note = ?9, updated_by = ?by, updated_at = ?now
WHERE id = ?1 AND deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM recipients WHERE id = ?2 AND deleted_at IS NULL);

-- 削除（論理削除）
UPDATE memos SET deleted_at = ?now, updated_by = ?by, updated_at = ?now
WHERE id = ?1 AND deleted_at IS NULL;
```

- 編集で0行だったときは、取次メモが削除済み・存在しないのか、宛先が削除されたのかを、アプリが取り直して見分ける
- 紐づける会社・担当者が、画面を開いている間に削除された場合は、SQL では弾かない（削除済みの会社・担当者に紐づいたメモができる）。紐づけは画面に出さず（Q-M34）、会社名・氏名・電話番号は作成時の値を持つので、表示には影響しない

### 3.6 対処済み・未対処の切り替え（S-03・F-05）
既に対処済みのときは上書きしない（Q-M33 の仮の形。最初に対処済みにした人・日時を残す）。更新者・更新日時は書かない（Q-M33 で未決）。

```sql
UPDATE memos SET status = 'done', done_by = ?by, done_at = ?now
WHERE id = ?1 AND deleted_at IS NULL AND status = 'open';

UPDATE memos SET status = 'open', done_by = NULL, done_at = NULL
WHERE id = ?1 AND deleted_at IS NULL AND status = 'done';
```

### 3.7 宛先の追加・編集・削除（S-11・S-10・F-09）

```sql
-- 追加：表示名・メールアドレスは利用者のもの。宛先になっていない利用者だけ（UNIQUE でも弾かれる）
INSERT INTO recipients (display_name, email, created_at, updated_by, updated_at)
SELECT u.name, u.email, ?now, ?by, ?now FROM users u
WHERE u.id = ?1 AND NOT EXISTS (SELECT 1 FROM recipients r WHERE r.email = u.email)
RETURNING id;  -- 0行なら「利用者は必須です」（Q-M25 の仮の形）

-- 編集：表示名だけ（メールアドレスは変えない）
UPDATE recipients SET display_name = ?2, updated_by = ?by, updated_at = ?now
WHERE id = ?1 AND deleted_at IS NULL;

-- 削除（論理削除）。宛先の取次メモ・取次可否はそのまま
UPDATE recipients SET deleted_at = ?now, updated_by = ?by, updated_at = ?now
WHERE id = ?1 AND deleted_at IS NULL;
```

## 4. 実行計画（ローカルの D1 で確かめた）
| 処理 | 実行計画 |
|---|---|
| 取次メモ一覧（条件なし） | `SCAN m USING INDEX memos_active_received`（並べ替えなし） |
| 取次メモ一覧（自分宛て・期間） | `SEARCH m USING INDEX memos_active_recipient_received (recipient_id=? AND received_at>? AND received_at<?)`（並べ替えなし。宛先の ID を `=` で渡すとき。2.3） |
| 会社一覧 | `SCAN c USING INDEX companies_active_kana`、担当者数は `SEARCH p USING INDEX contacts_active_company` |
| 相手の検索 | `SCAN c USING INDEX companies_active_kana`、担当者は `SEARCH p USING INDEX contacts_active_company`（部分一致なので会社は全件を見る） |

## 5. エンジニアが DB で行う操作
`wrangler d1 execute DB --remote --command "..."` で行う（リモートの D1 はモックのデプロイ先と共用。README 5章）。

### 5.1 宛先を直接登録する（F-09：まだログインしていない人）
```sql
INSERT INTO recipients (display_name, email) VALUES ('社長', 'xxx@h-company.co.jp');
-- 更新者・更新日時は NULL（Q-M24）
```

### 5.2 削除した会社を、一緒に削除された担当者ごと戻す
```sql
-- 1. 会社の削除日時を確かめる
SELECT id, name, kana, deleted_at, updated_by FROM companies WHERE id = 123;

-- 2. 一緒に削除された担当者（削除日時が会社と同じ）と、それより前に個別に削除された担当者を確かめる
SELECT id, name, kana, deleted_at,
       deleted_at = (SELECT deleted_at FROM companies WHERE id = 123) AS deleted_with_company
FROM contacts WHERE company_id = 123 AND deleted_at IS NOT NULL;

-- 3. 戻す。1. で確かめた削除日時をそのまま書く（文の順番に左右されないように）
UPDATE contacts  SET deleted_at = NULL WHERE company_id = 123 AND deleted_at = '2026-11-07T02:00:00.000Z';
UPDATE companies SET deleted_at = NULL WHERE id = 123         AND deleted_at = '2026-11-07T02:00:00.000Z';
```

- 復旧では `deleted_at` だけを戻し、`updated_by`・`updated_at` は変えない（README 1.3）
- そのため復旧したあとは、S-06・S-08・S-10 の更新者・更新日時に、**削除した人・削除した日時**が出る（次に画面から編集するまで）

### 5.3 担当者・宛先・取次メモを戻す
```sql
UPDATE contacts   SET deleted_at = NULL WHERE id = 456;  -- 会社が削除されていないことを先に確かめる
UPDATE recipients SET deleted_at = NULL WHERE id = 7;
UPDATE memos      SET deleted_at = NULL WHERE id = 890;
```
