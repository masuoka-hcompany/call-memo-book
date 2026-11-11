import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { accessAuth } from "./middleware/access.ts";
import { currentUser } from "./middleware/current-user.ts";
import { assets } from "./routes/assets.ts";
import { mock } from "./routes/mock.tsx";
import { placeholder } from "./routes/placeholder.tsx";
import { styleguide } from "./routes/styleguide.tsx";
import type { AppEnv } from "./types.ts";

const app = new Hono<AppEnv>();

app.use(logger());
app.use(secureHeaders());
// すべてのルートで Access の JWT を検証する
app.use(accessAuth());
// フォーム POST を同一オリジンからのものに限定する
app.use(csrf());

app.route("/", assets);

// モック専用（MOCK_MODE=true のときだけ。Access の認証のあと。ログイン中の利用者は各ルーターで決める）
app.route("/", styleguide);
app.route("/", mock);

// 画面上の「ログイン中の利用者」を決める（Access の認証のあと）
app.use(currentUser);

// 画面（作った画面のルートは placeholder より前に登録する）

// まだ作っていない画面の仮のページ
app.route("/", placeholder);

export default app;
