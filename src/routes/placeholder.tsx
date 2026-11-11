// まだ作っていない画面の仮のページ
// メニューや画面内のリンクから開けるように、画面ごとの URL（src/views/screens.ts）で画面名だけを表示する。
// 画面を作ったら、その画面のルートをこれより前に登録する（index.tsx）。

import { Hono } from "hono";
import type { AppEnv } from "../types.ts";
import { MockBox } from "../views/components.tsx";
import { MOCK_LABELS } from "../views/labels.ts";
import { SCREENS } from "../views/screens.ts";
import { renderPage } from "./page.tsx";

export const placeholder = new Hono<AppEnv>();

for (const s of SCREENS) {
  for (const path of s.paths) {
    placeholder.get(path, (c) =>
      renderPage(c, {
        title: s.name,
        nav: s.nav,
        children: (
          <MockBox class="inline-block px-4 py-3">
            {MOCK_LABELS.notBuilt}（{s.id}）
          </MockBox>
        ),
      }),
    );
  }
}
