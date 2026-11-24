# ハーネスの方針

AI エージェントと人間が、同じ手順で安全に開発するための土台（ハーネス）の方針。
範囲は、AI 設定（ルールファイル）、テスト、型チェック、Lint、Format、マイグレーションの適用。

- 決めた日：2026-11-24（益岡）。Claude と ChatGPT に別々に検討させ、結果を突き合わせて決めた
- エージェントが守るルールそのものは `AGENTS.md`。このファイルは、なぜそうしたかと、これからの予定を書く

## 1. 方針

道具は増やさず、「コンテナの中で実行」「ルールは `AGENTS.md` に 1 つ」「DB は素の SQL のまま」を軸にする。

| 論点 | 方針 | 理由・補足 |
|---|---|---|
| コマンドを実行する場所 | 開発用コンテナの中で実行する。コンテナの外のエージェントは `scripts/in-container.sh` を通す | `node_modules`・workerd・ローカルの D1 はコンテナの中にしかない。実行する場所を 1 つにすると、手元と CI の結果がずれにくい。入口は `npm run check` の 1 つ |
| ルールファイル | `AGENTS.md` を正にする。`CLAUDE.md` は `@AGENTS.md` の読み込みと、Claude Code だけの注意 | エージェントごとに書くと、同じルールが食い違う。`.github/copilot-instructions.md` は、Copilot が `AGENTS.md` を読まないと分かったときだけ作る |
| 仕組みで守る範囲 | Claude Code の権限設定（`.claude/settings.json` の deny）と、テスト・CI で守る | 勉強会の手順（各自がコンテナの中で `npm run setup`・`npm run deploy` を実行する）は変えないので、Cloudflare のトークンはコンテナに残る。**deny は事故を減らす補助**で、Claude Code 以外には効かず、`sh -c` で包んだコマンドにも効かない |
| 型の生成 | `worker-configuration.d.ts` は追跡し、CI で `wrangler types --check` をかける。型チェックでは作り直さない | 以前は `npm run typecheck` が毎回作り直し、手元の `.dev.vars` の中身で生成結果が変わっていた。`wrangler.jsonc` の `"secrets": { "required": [] }` で、`.dev.vars` の影響をなくした |
| Lint／Format | Biome だけを続ける。コミット前のフックは入れず、Claude Code の編集後のフックと CI で守る | コミット前のフックは、`node_modules` のないホスト側で動かない。SQL・Markdown の整形ツールは入れない |
| DB へのアクセス | 素の SQL ＋手書きの型。ORM（Drizzle・Prisma）は入れない。次点は Kysely（クエリだけ） | `docs/db/queries.md` に SQL がそろっている。このスキーマ（`COLLATE NOCASE`、式を使う CHECK、降順の部分インデックス）は、ORM のマイグレーション生成では表しきれず、生成物を手で直すことになる |
| マイグレーション | 適用は `wrangler d1 migrations apply` のまま。書き換えと番号の重なりを CI で見つける | 決まりは `docs/migrations.md`。リモートに当てたものは書き換えない。どこまで当てたかは `migrations/APPLIED`（いまは `0001`）。`0002` は、当てる前に DB アクセスの試作でスキーマを固める |
| フロントのビルド | Tailwind ＋ daisyUI だけを CLI でビルドする。JS はバンドルしない。クライアントの動きは Alpine.js（予定） | `@tailwindcss/browser`（ブラウザ上で CSS を作る方式）は本番向けではない。hono/jsx/dom はクライアント用のバンドルが要るので使わない |
| E2E | Playwright で主要な流れを数本。htmx・Alpine を使う最初の画面のあとに入れる（予定） | いまのテストは HTML の文字列までしか見られない。認証は、すでにあるローカル用の分岐（`ENVIRONMENT=local` かつ localhost）を使う |
| モック | 捨てる。Worker 名は変えず、本実装のデプロイでモックを上書きする | モック（`mock/step1`）の共通のルール・domain・テストは、必要なものだけ本実装に移す |

## 2. 仕組みで守っているもの

| 守ること | 仕組み | 置き場所 |
|---|---|---|
| Lint・型・テストが通ること | `npm run check`、PR の CI | `package.json`、`.github/workflows/ci.yml` |
| 生成した型が `wrangler.jsonc` と合っていること | `npm run types:check`（CI と `npm run check` で実行） | 同上 |
| リモートに当てたマイグレーションを書き換えないこと、番号が重ならないこと | `npm run migrations:check`（CI と `npm run check` で実行） | `scripts/check-migrations.ts`、`scripts/migrations-rules.ts` |
| `migrations/APPLIED` を人間だけが更新すること | Claude Code の deny（`Edit`）。ほかは `AGENTS.md` のルールと、PR のレビュー | `.claude/settings.json` |
| 整形と Lint の自動修正 | Claude Code の編集後のフック（コンテナの中で動かしているときだけ） | `.claude/settings.json`、`scripts/format-edited.ts` |
| デプロイ・リモートの操作をしない | Claude Code の deny。ほかのエージェントは `AGENTS.md` のルールだけ | `.claude/settings.json` |
| `.env`・`.dev.vars` を読まない | Claude Code の deny（`Read`）。シェルの `cat` などには効かない | 同上 |
| Access の認証を外さない | `test/access.test.ts`（署名・aud・iss・期限切れ・設定なしでの拒否 など）、`test/items.test.ts`（Worker 全体での拒否） | `test/` |

## 3. これからの予定

1 回に 1 つのテーマで PR を出す。

| PR | 中身 | 状態 |
|---|---|---|
| ① main の後始末 | `ACCESS_AUD` を、作り直した Access アプリの値に更新 | マージ済み |
| ② AI 設定と実行の入口 | `npm run check`、`scripts/in-container.sh`、型の生成の整理、`AGENTS.md`・`CLAUDE.md`・`.claude/settings.json`、Dev Container への Claude Code の追加、このファイル | PR #5 |
| ③ マイグレーションの検査 | 書き換え・番号の重なりを見つけるスクリプト、適用済みの境界（`migrations/APPLIED`）、`docs/migrations.md`（列を消す変更は 2 段階、シードの分け方） | この PR |
| ④ DB アクセスの試作 | 行の型、`batch` のヘルパー、DB の列と型を突き合わせるテスト。必要なら `0002` を直す | これから |

④ のあと、人間が `0002` をリモートに当てる。そのあとは画面の実装と一緒に進める：CSS のビルド → htmx・Alpine と最初の画面 → E2E → `src/domain/` のカバレッジ、依存の更新（Dependabot）。

## 4. 入れる前に確かめること

- [ ] `0001` がリモートに当たっているか（人間が `wrangler d1 migrations list --remote` で確かめる）
- [ ] Claude Code の deny のパターンが効くか（`/permissions` で確かめる）
- [ ] Dev Container の中で Claude Code の拡張機能が動き、作り直してもログインが残るか
- [ ] Copilot が `AGENTS.md` を読むか（`AGENTS.md` にだけ書いた決まりを質問して確かめる）
- [x] `"secrets": { "required": [] }` を入れても、ローカルの認証のスキップと `DEV_USER_EMAIL` が動くか → `DEV_USER_EMAIL` を `vars` に宣言すれば動く（2026-11-24 に確認）
- [ ] DB（`0002` を当てる前）：`batch` の 2 つ目の文が失敗したとき 1 つ目も戻るか、UPSERT で `created_at` が変わらないか、一覧が部分インデックスを使うか（`EXPLAIN QUERY PLAN`）、CHECK 違反のときのエラーの形
- [ ] daisyUI をビルドに変えても、`app.css` の上書きが優先されるか（`docs/design.md` 6章は、CDN 版が `@layer` の中にあることを前提にしている）
- [ ] htmx は 2 か 4 か：最初の画面で、GET・POST・入力エラーの表示・Alpine との併用を試す

## 5. 後回しにしたこと

- **テーブルの作り直しの手順と、その検査**：最初の作り直しが必要になったときに決める。SQLite は CHECK 制約を `ALTER` で変えられず、D1 では `PRAGMA foreign_keys = OFF` が効かない（`PRAGMA defer_foreign_keys = on` を使う）。本番に当てる前に、データを入れたローカルの D1 でリハーサルをする
- **`docs/design.md` の禁止クラスの機械チェック**：画面が数枚できてから
- **JWKS の取得の失敗と、鍵の入れ替えのテスト**
- **取次メモの二重登録の防止**（保存ボタンの連打）：htmx を入れる画面で決める
- **バックアップと復元の手順**（D1 の Time Travel）：仕様書でも未定。利用が始まる前に決める
- **Kysely**：動的な検索条件が増えたとき、または型の直し忘れがテストでたびたび見つかるときに検討する
