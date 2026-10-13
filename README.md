# call-memo-book

勉強会で開発する、電話メモと電話帳をまとめて管理できるアプリ

Cloudflare Workers + D1 + Hono + Cloudflare Access で構成している。ローカル開発は Docker（VS Code Dev Containers 推奨）で行い、ホストに Node.js を入れる必要はない。

- アカウント運用方針: [docs/account-policy.md](docs/account-policy.md)（必ず先に読むこと）
- Cloudflare 側の設定手順（自分のアカウント・Access・Google ログイン）: [docs/cloudflare-setup.md](docs/cloudflare-setup.md)

## 1. 前提

| 必要なもの                                                                                            | 備考                                                                              |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/)                                     | Windows では WSL2 バックエンドを使う（「5. Windows 向けの注意事項」）             |
| [VS Code](https://code.visualstudio.com/) + [Dev Containers 拡張](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) | Dev Containers を使わない場合は不要（`docker compose` だけでも開発できる）        |
| 自分の Cloudflare アカウント（無料プラン）と Zero Trust | [cloudflare-setup.md「1. アカウントの準備」](docs/cloudflare-setup.md#1-アカウントの準備) |
| 自分の API トークン（**D1 の Edit 権限を追加したもの**）とアカウント ID | [cloudflare-setup.md「1-3」「1-4」](docs/cloudflare-setup.md#1-3-api-トークンを発行する) |
| Access のチームドメインと AUD タグ | 手順 9 で自分の Zero Trust から取得する |

## 2. clone から本番 URL での動作確認まで

### Dev Containers を使う場合（推奨）

1. WSL2（Ubuntu など）のホームディレクトリ配下に clone する。

   ```sh
   git clone <このリポジトリの URL> ~/src/call-memo-book
   cd ~/src/call-memo-book
   ```

2. 認証情報を設定する。`.env` に API トークンとアカウント ID を入れる。

   ```sh
   cp .env.example .env
   ```

3. ローカル用の変数ファイルを作る（中身はそのままで動く）。

   ```sh
   cp .dev.vars.example .dev.vars
   ```

4. `code .` で VS Code を開き、コマンドパレットから **Dev Containers: Reopen in Container** を実行する。初回はイメージのビルドと `npm ci`、ローカル D1 へのマイグレーション適用が自動で行われる。
5. 開発サーバーを起動し、ブラウザで <http://localhost:8787> を開く。右上にダミーユーザー（`dev-user@example.com`）が表示される。

   ```sh
   npm run dev
   ```

6. アイテムを登録・削除できること、`src/` のファイルを保存すると自動でリロードされることを確認する。必要ならダミーデータを入れる: `npm run db:seed:local`
7. VS Code のターミナル（コンテナ内）で、自分の Worker と D1 を作成する。Worker 名と D1 名を聞かれる（名前は自由。小文字英数字とハイフン、D1 名は Enter で `<Worker 名>-db`）。マイグレーションの確認が出たら `y`。

   ```sh
   npm run setup
   # 対話なしの場合: npm run setup -- --name call-memo-book
   ```

   Worker 名・D1 名・`database_id` が `wrangler.jsonc` に書き込まれる。`database_id` が変わるので、ローカルのデータは空になる（必要なら `npm run db:seed:local`）。

8. デプロイする。リモート D1 にマイグレーションが適用されてから Worker がデプロイされる（確認が出たら `y`）。

   ```sh
   npm run deploy
   ```

   表示された `https://<Worker 名>.<サブドメイン>.workers.dev` を開くと、**500「Server misconfiguration」になる。これが正常**（Access の値が空のうちは、すべてのリクエストを拒否する）。

9. Zero Trust で自分の Worker 用の Access アプリケーションを作成し、チームドメインと AUD タグを `wrangler.jsonc` の `vars` に入れる（[cloudflare-setup.md「4. Access で保護して再デプロイする」](docs/cloudflare-setup.md#4-access-で保護して再デプロイする)）。

   ```jsonc
   "vars": {
     "ENVIRONMENT": "production",
     "ACCESS_TEAM_DOMAIN": "<チーム名>.cloudflareaccess.com",
     "ACCESS_AUD": "<AUD タグ>"
   }
   ```

10. もう一度 `npm run deploy` を実行し、URL を開く。Access のログイン画面でログインし、右上に自分のメールアドレスが表示されれば完了。

### Dev Containers を使わない場合

手順 1〜3 は同じ。その後は次のように操作する（手順の内容は上と同じ）。

```sh
docker compose up            # 依存のインストール → ローカル D1 マイグレーション → 開発サーバー起動
                             # http://localhost:8787 で確認できる。npm run dev は不要（自動で動いている）
# 別のターミナルで
docker compose exec app npx wrangler whoami   # .env の認証情報が効いているか確認
docker compose exec app npm run setup
docker compose exec app npm run deploy
```

`.env` を後から作成・変更した場合は、`docker compose up -d --force-recreate` でコンテナを作り直す（`.env` は起動時にしか読まれない）。

> Dev Containers と `docker compose up` は同じコンテナ・ボリュームを使うので、同時には起動しないこと（ポート 8787 が競合する）。

## 3. よく使うコマンド

コンテナ内で実行する（`docker compose` 運用なら先頭に `docker compose exec app` を付ける）。

| コマンド                   | 内容                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `npm run setup`            | 自分の D1 を作成し、Worker 名・D1 名・`database_id` を `wrangler.jsonc` に書き込む    |
| `npm run dev`              | ローカル開発サーバーを起動する（<http://localhost:8787>）                             |
| `npm run db:migrate:local` | ローカル D1 にマイグレーションを適用する                                              |
| `npm run db:seed:local`    | ローカル D1 に seed（`seed/seed.sql`）を投入する                                      |
| `npm run deploy`           | リモート D1 にマイグレーションを適用し、`wrangler deploy` する                        |
| `npm run destroy`          | 確認の後、自分の Worker と D1 を削除し、`wrangler.jsonc` をプレースホルダに戻す       |
| `npm test`                 | テストを実行する（Workers ランタイム上で動く）                                        |
| `npm run typecheck`        | 型を生成（`wrangler types`）してから型チェックする                                    |
| `npm run lint` / `format`  | Biome でチェック／自動修正する                                                        |

マイグレーションを追加するときは `npx wrangler d1 migrations create DB <名前>` で `migrations/` にファイルを作る。ダッシュボードでスキーマを直接変更しないこと。

## 4. ディレクトリ構成

```text
.
├── .devcontainer/           VS Code Dev Containers の設定（compose.yaml を使う）
├── .github/workflows/       CI（PR 時の型チェック・テスト）とデプロイ（main への push 時）。勉強会では使わない
├── docs/
│   ├── account-policy.md    Cloudflare アカウント運用方針
│   └── cloudflare-setup.md  Cloudflare 側の設定手順（アカウント・Access・ログイン方法）
├── migrations/              D1 のマイグレーション（スキーマはここで管理する）
├── scripts/                 setup / deploy / destroy などの Node.js スクリプト
├── seed/                    ローカル D1 用のダミーデータ
├── src/
│   ├── index.tsx            エントリポイント（ミドルウェアとルートの登録）
│   ├── middleware/access.ts Cloudflare Access の JWT 検証
│   ├── routes/items.tsx     CRUD サンプル（一覧・登録・削除）
│   ├── views/Layout.tsx     共通レイアウト（Hono JSX）
│   └── types.ts             Hono の型（Bindings / Variables）
├── test/                    テスト（@cloudflare/vitest-plugin）
├── compose.yaml / Dockerfile ローカル開発用コンテナ
├── wrangler.jsonc           Wrangler 設定
├── worker-configuration.d.ts `wrangler types` が生成する型（npm run typecheck で再生成される）
├── .env.example             Cloudflare の認証情報（コピーして .env を作る）
└── .dev.vars.example        ローカル用の変数（コピーして .dev.vars を作る）
```

### 環境ごとの値

| 値                   | ローカル（`.dev.vars`）    | デプロイ先（`wrangler.jsonc` の `vars`） |
| -------------------- | -------------------------- | ---------------------------------------- |
| `ENVIRONMENT`        | `local`                    | `production`                             |
| `ACCESS_TEAM_DOMAIN` | 不要                       | `<チーム名>.cloudflareaccess.com`        |
| `ACCESS_AUD`         | 不要                       | Access アプリケーションの AUD タグ       |
| `DEV_USER_EMAIL`     | ダミーユーザーのメール     | 設定しない                               |

### Access の検証

- すべてのリクエストで `Cf-Access-Jwt-Assertion` ヘッダーの JWT を検証し、メールアドレスを `c.var.userEmail` で取得できるようにしている。ユーザーの識別には `sub` ではなくメールアドレスを使う。
- `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` が未設定なら、検証をスキップせずに 500 を返す。
- 検証をスキップするのは、`ENVIRONMENT=local` かつ `localhost` / `127.0.0.1` へのリクエストのときだけ。

## 5. Windows 向けの注意事項

- **リポジトリは WSL2 のファイルシステム上（`~/src/...`）に置く。** `C:\` 配下に置くと動作が遅く、ファイルの変更が検知されない（自動リロードが効かない）ことがある。
- Docker Desktop の **Settings → Resources → WSL integration** で、使っているディストリビューション（Ubuntu など）を有効にする。
- やむを得ず `C:\` 配下に置く場合は、`.env` に `CHOKIDAR_USEPOLLING=true` を設定してコンテナを作り直すと、ポーリングで変更を検知する（CPU 負荷は上がる）。
- WSL の Ubuntu 20.04 など glibc が古い環境では、ホスト上で `npm run dev` や `npm test` を実行すると workerd が動かない。必ずコンテナ内で実行する。
- 改行コードは `.gitattributes` で LF に揃えている。

## 6. トラブルシューティング

| 症状                                                                       | 対処                                                                                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `環境変数 CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID が設定されていません` | `.env` に値を入れ、コンテナを作り直す（Dev Containers: **Rebuild Container**、compose: `docker compose up -d --force-recreate`）。`.env` は起動時にしか読まれない |
| `Authentication error [code: 10000]` などで `setup` / `deploy` が失敗する | API トークンに **Account → D1 → Edit** があるか（テンプレート「Edit Cloudflare Workers」には含まれない）と、対象アカウントを確認する。[cloudflare-setup.md「1-3」](docs/cloudflare-setup.md#1-3-api-トークンを発行する)                              |
| ローカルで `Server misconfiguration`（500）になる                          | `.dev.vars` がない、または `ENVIRONMENT=local` になっていない。`localhost:8787` 以外（IP アドレスなど）でアクセスしていないかも確認する                       |
| デプロイ先で `Server misconfiguration`（500）になる                        | `wrangler.jsonc` の `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` が空。値を入れて再デプロイする                                                                        |
| デプロイ先で `Forbidden`（403）になる                                      | Access を経由していない、または AUD タグ・チームドメインが違う。Zero Trust の Access アプリケーションの公開ホスト名と AUD タグを確認する。`npx wrangler tail` で理由（`unexpected "aud"` など）が見られる                                                                              |
| Access のログイン後に「アクセス権がない」と表示される | Access アプリケーションのポリシーに、ログインしたメールアドレスが含まれているか確認する |
| `npm run setup` の後、ローカルのデータが消えた                             | ローカル D1 は `database_id` ごとに保存されるため。`npm run db:migrate:local` と `npm run db:seed:local` を実行する                                           |
| ソースを変更してもリロードされない                                         | 「5. Windows 向けの注意事項」を参照                                                                                                                          |
| `port is already allocated`（8787）                                         | Dev Container と `docker compose up` を同時に起動していないか、他のプロセスが 8787 を使っていないか確認する                                                  |
| `npm run dev` で `bind(): Address already in use`                          | `docker compose up` で起動した場合は開発サーバーが自動で動いているので、`npm run dev` は不要。ログは `docker compose logs -f app` で見る                      |
| `package.json` を変えたのに反映されない                                    | コンテナを再起動する（起動時に `package-lock.json` の変更を検知して `npm ci` する）。手動なら `node scripts/ensure-deps.ts`                                  |
| `wrangler.jsonc` に `call_memo_book_db` のような D1 設定が増えた | `wrangler d1 create` の質問「設定に追加する」に Yes と答えたため（`npm run setup` では聞かれない）。`binding` が `DB` のもの以外を削除する |
| `Docker Desktop is unable to start`                                        | Docker Desktop を再起動する（`docker desktop restart`）                                                                                                      |
| ローカル D1 を作り直したい                                                 | `docker compose down -v` でボリュームごと削除する（node_modules も消える）                                                                                  |

## 7. 本採用時の移行チェックリスト

採用されたアプリを、各自のアカウントから会社の Cloudflare アカウントへ移す。詳細は [account-policy.md「6. 本採用アプリの本番化」](docs/account-policy.md#6-本採用アプリの本番化会社アカウント)。

- [ ] 管理者が会社アカウントの Zero Trust に **Google Workspace** をログイン方法として追加し、ポリシーを社内ドメイン（または Google グループ）にする
- [ ] 会社アカウントの API トークンとアカウント ID で、本番用の D1 を作成する: `npx wrangler d1 create <本番名>-db`
- [ ] `wrangler.jsonc` の `name`・`database_name`・`database_id` を本番用に書き換える
- [ ] 会社アカウントで Access アプリケーションを作成し、`vars` の `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` をその値に差し替える
- [ ] 必要なら独自ドメインを `routes` で割り当て、Access アプリケーションの対象にする。workers.dev を使わない場合は `workers_dev` を `false` にする
- [ ] シークレットが必要になったら `npx wrangler secret put <名前>` で設定する（`vars` に同名の値がある場合は削除してから）
- [ ] GitHub Secrets に会社アカウントの `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を設定し、[deploy ワークフロー](.github/workflows/deploy.yml)を有効にする（以降、本番デプロイは CI からのみ行う）
- [ ] 勉強会のデータは移行しない。各自のアカウントの Worker / D1 は `npm run destroy` で削除してよい
- [ ] 実データの投入は本番化の後に行う
