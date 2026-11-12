// 画面上の「ログイン中の利用者」を決めるミドルウェア（Access の認証のあとに置く）
//
// - MOCK_MODE=true：モック用のログインユーザー切替で選んだ利用者（Cookie。ブラウザごと）。
//   指定がない・見つからないときは「菊地」（仕様書 10.2 の共通の前提）。Access でログインした本人とは別。
// - それ以外：Access でログインした本人のメールアドレスで利用者を探す。
//   初回ログイン時の利用者登録（F-10）はモックでは作らないため、見つからなければ拒否する。

import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { isMockMode } from "../mock/mode.ts";
import { DEFAULT_LOGIN_EMAIL } from "../mock/seeds.ts";
import { findUserByEmail, findUserById, listUsers } from "../repo/users.ts";
import type { AppEnv } from "../types.ts";

export const MOCK_USER_COOKIE = "mock_user";

export const currentUser = createMiddleware<AppEnv>(async (c, next) => {
  if (isMockMode(c.env)) {
    const id = Number(getCookie(c, MOCK_USER_COOKIE));
    const user =
      (Number.isInteger(id) ? await findUserById(id) : null) ??
      (await findUserByEmail(DEFAULT_LOGIN_EMAIL)) ??
      (await listUsers())[0] ??
      null;
    if (!user) {
      return c.text("Forbidden", 403);
    }
    c.set("currentUser", user);
    return next();
  }

  const user = await findUserByEmail(c.var.userEmail);
  if (!user) {
    return c.text("Forbidden", 403);
  }
  c.set("currentUser", user);
  return next();
});

// モック用：ログインユーザーを切り替える（Cookie に利用者の ID を入れる）
export function setMockUser(c: Context<AppEnv>, userId: number): void {
  setCookie(c, MOCK_USER_COOKIE, String(userId), {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
  });
}
