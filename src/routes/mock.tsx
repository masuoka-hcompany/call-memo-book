// モック専用のルート（MOCK_MODE=true のときだけ。Access の認証のあと）
// - GET  /__seed            シードへのリンクの一覧（レビュー会で使う）
// - GET  /__seed/:name      データを入れ替え、ログインユーザーを切り替えて、決まった画面にリダイレクトする
// - GET  /__debug/store     削除済みを含む全データを JSON で表示する
// - POST /__mock/login-user ログインユーザー切替
//
// デプロイ先では、シードはそのとき応答したインスタンスのデータだけを入れ替える。

import { Hono } from "hono";
import { currentUser, setMockUser } from "../middleware/current-user.ts";
import { mockOnly } from "../mock/mode.ts";
import { findSeed, SEEDS } from "../mock/seeds.ts";
import { replaceStore, snapshotStore } from "../mock/store.ts";
import { findUserByEmail, findUserById } from "../repo/users.ts";
import type { AppEnv } from "../types.ts";
import { MOCK_USER_SWITCH_PATH } from "../views/AppLayout.tsx";
import { MockBox } from "../views/components.tsx";
import { renderPage } from "./page.tsx";

export const mock = new Hono<AppEnv>();

// MOCK_MODE でなければ 404（ログイン中の利用者を決めるのは、そのあと）
for (const path of ["/__seed", "/__seed/*", "/__debug/*", "/__mock/*"]) {
  mock.use(path, mockOnly, currentUser);
}

mock.get("/__seed", (c) =>
  renderPage(c, {
    title: "シード（モック用）",
    nav: null,
    children: (
      <MockBox class="max-w-4xl px-4 py-3">
        <p class="mb-4">
          リンクを開くと、データを入れ替えてログインユーザーを切り替え、決まった画面を開く。デプロイ先では、同じインスタンスにいるほかの人のデータも入れ替わる。
        </p>
        <table class="w-full">
          <tbody>
            {SEEDS.map((s) => (
              <tr class="border-b border-base-300">
                <td class="py-2 pr-6 align-top">
                  <a class="link" href={`/__seed/${s.name}`}>
                    /__seed/{s.name}
                  </a>
                </td>
                <td class="py-2">{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul class="mt-4 flex gap-6">
          <li>
            <a class="link" href="/__debug/store">
              /__debug/store
            </a>
          </li>
          <li>
            <a class="link" href="/__styleguide">
              /__styleguide
            </a>
          </li>
        </ul>
      </MockBox>
    ),
  }),
);

mock.get("/__seed/:name", async (c) => {
  const seed = findSeed(c.req.param("name"));
  if (!seed) {
    return c.notFound();
  }
  replaceStore(seed.build());
  const user = await findUserByEmail(seed.loginEmail);
  if (user) {
    setMockUser(c, user.id);
  }
  return c.redirect(seed.redirect, 303);
});

mock.get("/__debug/store", (c) => {
  c.header("Content-Type", "application/json; charset=utf-8");
  c.header("Cache-Control", "no-store");
  return c.body(JSON.stringify(snapshotStore(), null, 2));
});

// 戻り先は同じサイトのパスだけにする（//example.com のような別サイトへの転送を防ぐ）
function safeBack(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/";
}

mock.post(MOCK_USER_SWITCH_PATH, async (c) => {
  const body = await c.req.parseBody();
  const user = await findUserById(Number(body.user));
  if (user) {
    setMockUser(c, user.id);
  }
  return c.redirect(safeBack(body.back), 303);
});
