// ビルドしない CSS を Worker から配信する（Access の認証を通ったあとで返す）

import { Hono } from "hono";
import appCss from "../styles/app.css";
import type { AppEnv } from "../types.ts";

export const APP_CSS_PATH = "/styles/app.css";

export const assets = new Hono<AppEnv>();

assets.get(APP_CSS_PATH, (c) => {
  c.header("Content-Type", "text/css; charset=utf-8");
  c.header("Cache-Control", "no-cache");
  return c.body(appCss);
});
