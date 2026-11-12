// 画面を返すときの共通処理：レイアウト、ログイン中の利用者、モック用の切替、完了メッセージ

import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Child } from "hono/jsx";
import { isMockMode } from "../mock/mode.ts";
import { listUsers } from "../repo/users.ts";
import type { AppEnv } from "../types.ts";
import { AppLayout } from "../views/AppLayout.tsx";
import { FLASH_MESSAGES, type FlashKey, isFlashKey } from "../views/messages.ts";
import type { NavKey } from "../views/screens.ts";

const FLASH_COOKIE = "flash";

// 完了メッセージを次の画面に渡す（リダイレクトの前に呼ぶ）
export function setFlash(c: Context<AppEnv>, key: FlashKey): void {
  setCookie(c, FLASH_COOKIE, key, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
  });
}

// 完了メッセージを取り出す（1回表示したら消す）
function takeFlash(c: Context<AppEnv>): string | null {
  const key = getCookie(c, FLASH_COOKIE);
  if (key === undefined) return null;
  deleteCookie(c, FLASH_COOKIE, { path: "/" });
  return isFlashKey(key) ? FLASH_MESSAGES[key] : null;
}

// いまの画面の URL（パスとクエリ）
export function currentPath(c: Context<AppEnv>): string {
  const url = new URL(c.req.url);
  return `${url.pathname}${url.search}`;
}

export async function renderPage(
  c: Context<AppEnv>,
  props: { title: string; nav: NavKey | null; children?: Child; status?: 200 | 404 },
) {
  const mock = isMockMode(c.env) ? { users: await listUsers(), back: currentPath(c) } : null;
  return c.html(
    <AppLayout title={props.title} nav={props.nav} currentUser={c.var.currentUser} mock={mock} flash={takeFlash(c)}>
      {props.children}
    </AppLayout>,
    props.status ?? 200,
  );
}
