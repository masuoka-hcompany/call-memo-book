// すべての画面で共通の HTML 文書（<head> と CSS・JS の読み込み）
// ビルドしないため、CSS・JS は CDN からバージョンを固定して読み込む。デザインのルールは docs/design.md。

import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { APP_CSS_PATH } from "../routes/assets.ts";

export const CDN = {
  daisyui: "https://cdn.jsdelivr.net/npm/daisyui@5.7.50/daisyui.css",
  tailwind: "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3",
} as const;

type Props = {
  title: string;
  children: Child;
};

export function Document({ title, children }: Props) {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="ja" data-theme="rams-a">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link rel="stylesheet" href={CDN.daisyui} />
          <link rel="stylesheet" href={APP_CSS_PATH} />
          <script src={CDN.tailwind} />
        </head>
        <body class="min-h-screen bg-base-100 text-base-content">{children}</body>
      </html>
    </>
  );
}
