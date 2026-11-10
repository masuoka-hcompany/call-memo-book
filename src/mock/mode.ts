// モック専用の仕組み（ログインユーザー切替、/__seed/*、/__debug/*、/__styleguide）を有効にするか
// Access の認証のあとに置き、MOCK_MODE=true のときだけ通す。それ以外は存在しないものとして 404 を返す。

import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types.ts";

export function isMockMode(env: AppEnv["Bindings"]): boolean {
  return env.MOCK_MODE === "true";
}

export const mockOnly = createMiddleware<AppEnv>(async (c, next) => {
  if (!isMockMode(c.env)) {
    return c.notFound();
  }
  return next();
});
