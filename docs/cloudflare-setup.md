# Cloudflare 側の設定手順

勉強会の参加者が、**自分の Cloudflare アカウント**で行う設定をまとめる。方針は [account-policy.md](./account-policy.md) を参照。

> 2026年10月時点の公式ドキュメントをもとに書いている。画面の名前や場所は変わることがあるので、見つからない場合は末尾の参考リンクを確認すること。

## 全体の流れ

```text
ブラウザ ──▶ Cloudflare Access（ログイン画面: ワンタイム PIN / Google）
                │ ログインに成功すると Cf-Access-Jwt-Assertion ヘッダーを付けて転送
                ▼
            自分の Worker（JWT を検証し、メールアドレスでユーザーを識別）──▶ D1
```

| 段階                       | やること                                                        | いつ           |
| -------------------------- | --------------------------------------------------------------- | -------------- |
| 1. アカウントの準備        | Cloudflare アカウント、workers.dev、Zero Trust、API トークン    | 勉強会の前日まで |
| 2. ログイン方法（任意）    | Google でログインしたい場合だけ、Google Cloud で OAuth を設定   | 勉強会の前日まで |
| 3. Access でアプリを保護   | `npm run setup` の後、Access アプリケーションを作成してデプロイ | 勉強会当日     |

## 1. アカウントの準備

### 1-1. Cloudflare アカウントを作成する

1. <https://dash.cloudflare.com/sign-up> でアカウントを作成する（無料プラン）。
2. ダッシュボードで **Workers & Pages** を開き、アカウントの workers.dev サブドメイン（`<サブドメイン>.workers.dev`）を決める。
   - アプリの URL は `<Worker 名>.<サブドメイン>.workers.dev` になる。

### 1-2. Zero Trust を有効にする

1. ダッシュボードから **Zero Trust** を開く。
2. チーム名を決める。チームドメイン `<チーム名>.cloudflareaccess.com` が、アプリの `ACCESS_TEAM_DOMAIN` の値になる。
   - 後から **Settings → Team name and domain** で確認できる。
3. **Free プラン**を選ぶ。支払い情報の入力を求められる場合がある（無料の範囲では請求されない）。
4. **Integrations → Identity providers** に **One-time PIN** があることを確認する。なければ **Add new identity provider** から追加する。
   - ワンタイム PIN は、メールで届くコードでログインする方式。Google Cloud 側の作業が不要で、アプリに届く JWT は Google ログインのときと同じ形なので、勉強会ではこれで十分。

### 1-3. API トークンを発行する

1. 右上のアイコン → **My Profile → API Tokens → Create Token** を選ぶ。
2. テンプレート **Edit Cloudflare Workers** の **Use template** を選ぶ。
3. 権限（Permissions）に **Account → D1 → Edit** を追加する。`npm run setup` / `deploy` / `destroy` で D1 を作成・マイグレーション・削除するため。
4. **Account Resources** は自分のアカウントを選ぶ。**Zone Resources** は今回使わない。
5. **Continue to summary → Create Token** を選ぶ。
6. 表示されたトークンをすぐにコピーし、`.env` の `CLOUDFLARE_API_TOKEN` に入れる。**トークンは一度しか表示されない。**

### 1-4. アカウント ID を確認する

- **Workers & Pages** の一覧画面の右側に表示されている **Account ID** をコピーし、`.env` の `CLOUDFLARE_ACCOUNT_ID` に入れる。
- コンテナ内で `npx wrangler whoami` を実行しても確認できる。

## 2. Google でログインする場合（任意）

ワンタイム PIN で進める場合は飛ばしてよい。

### 2-1. Google Cloud で OAuth クライアントを作成する

1. [Google Cloud コンソール](https://console.cloud.google.com/)で新しいプロジェクトを作成する。
2. **APIs & Services → Credentials → Configure Consent Screen** を開く。
   - アプリ名とサポート用メールアドレスを入力する。
   - 対象（Audience）は **External** を選ぶ。
   - 公開ステータスはテスト中のままでよい。その場合は **テストユーザーに自分の Gmail アドレスを追加する**（テストユーザー以外はログインできない）。
3. **Create OAuth client** を選び、次のように設定する。
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://<チーム名>.cloudflareaccess.com`
   - Authorized redirect URIs: `https://<チーム名>.cloudflareaccess.com/cdn-cgi/access/callback`
4. 作成したクライアントの **Client ID** と **Client secret** をコピーする。Client secret はパスワードと同じように扱う。

### 2-2. Zero Trust に Google を追加する

1. **Zero Trust → Integrations → Identity providers → Add new identity provider → Google** を選ぶ。
2. **App ID** に Client ID、**Client secret** に Client secret を入力して **Save** を選ぶ。
3. 一覧の Google の横にある **Test** で、ログインできることを確認する。

> **Google** は個人の Gmail を含む任意の Google アカウントでログインできる方式。会社の **Google Workspace** は本採用時に会社アカウントで設定する（[account-policy.md「6. 本採用アプリの本番化」](./account-policy.md#6-本採用アプリの本番化会社アカウント)）。

## 3. Access でアプリを保護してデプロイする

コンテナ内で `npm run setup` を実行し、Worker 名が決まってから行う。

### 3-1. Access アプリケーションを作成する

1. **Zero Trust → Access controls → Applications → Add an application → Self-hosted** を選ぶ。
2. アプリケーション名を入力し、公開ホスト名（Domain）に自分の Worker の URL `<Worker 名>.<サブドメイン>.workers.dev` を設定する。
3. ポリシーを作成する。
   - Action: **Allow**
   - Include: **Emails** に、自分のメールアドレスを入力する（Google ログインなら Gmail アドレス）。
   - **`Emails ending in` で `@gmail.com` を指定しないこと。** 世界中の Gmail ユーザーがアクセスできてしまう。
4. ログイン方法（Login methods）で、ワンタイム PIN と、設定した場合は Google を選ぶ。
5. 保存する。

### 3-2. チームドメインと AUD タグをアプリに設定する

1. 作成したアプリケーションを開き、**Application Audience (AUD) Tag** をコピーする。
2. `wrangler.jsonc` の `vars` に設定する。

   ```jsonc
   "vars": {
     "ENVIRONMENT": "production",
     "ACCESS_TEAM_DOMAIN": "<チーム名>.cloudflareaccess.com",
     "ACCESS_AUD": "<AUD タグ>"
   }
   ```

   空のままデプロイすると、アプリはすべてのリクエストを 500 で拒否する（設定漏れのまま公開されないようにするため）。

### 3-3. デプロイして確認する

1. コンテナ内で `npm run deploy` を実行する。
2. `https://<Worker 名>.<サブドメイン>.workers.dev` を開く。Access のログイン画面が表示されるので、ワンタイム PIN（または Google）でログインする。
3. 画面右上に自分のメールアドレスが表示されれば完了。
4. 許可していないメールアドレスではログインできないことも確認する（ワンタイム PIN で別のアドレスを入力すると、コードが届かず拒否される）。

> `wrangler dev`（ローカル）は Access を経由しないため、JWT ヘッダーは届かない。ローカルでは `.dev.vars` の `ENVIRONMENT=local` により検証をスキップし、`DEV_USER_EMAIL` のダミーユーザーとして動く。Access と JWT の動作は、workers.dev にデプロイして確認する。

## リハーサルで確認すること

- [ ] ワンタイム PIN（と Google）でログインでき、許可していないアドレスは拒否される
- [ ] デプロイした Worker で JWT の検証が通り、メールアドレスが表示される
- [ ] 上記の API トークンの権限で `npm run setup` / `npm run deploy` / `npm run destroy` が成功する
- [ ] Zero Trust の Free プランで、支払い情報の入力が必要か

## 参考リンク

- [Access の JWT の検証](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Google をログイン方法として追加する](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/)
- [Cloudflare Access（Workers）](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [API トークンの作成](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Workers の料金と上限](https://developers.cloudflare.com/workers/platform/pricing/)
