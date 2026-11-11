// 画面の一覧（仕様書 7.1）とメニュー
// 画面名・メニュー名は仕様書のとおり。URL はモックで決めたもの（仕様書には URL の定めがない）。

export type NavKey = "search" | "memos" | "companies" | "recipients";

// メニュー（全画面の上部。全員に表示する）
export const MENU: { key: NavKey; label: string; href: string }[] = [
  { key: "search", label: "相手検索", href: "/" },
  { key: "memos", label: "取次メモ一覧", href: "/memos" },
  { key: "companies", label: "会社一覧", href: "/companies" },
  { key: "recipients", label: "宛先一覧", href: "/recipients" },
];

export type ScreenId = "S-01" | "S-02" | "S-03" | "S-04" | "S-05" | "S-06" | "S-07" | "S-08" | "S-09" | "S-10" | "S-11";

export type Screen = {
  id: ScreenId;
  // 画面名（仕様書 7.1）
  name: string;
  // 現在地として強調するメニュー
  nav: NavKey;
  // この画面の URL（Hono のパスの書き方）
  paths: string[];
  // 作った画面は true（仮のページを出さない）
  built?: boolean;
};

export const SCREENS: Screen[] = [
  { id: "S-01", name: "相手検索", nav: "search", paths: ["/"], built: true },
  { id: "S-02", name: "取次メモ一覧", nav: "memos", paths: ["/memos"] },
  { id: "S-04", name: "取次メモ作成・編集", nav: "memos", paths: ["/memos/new", "/memos/:id{[0-9]+}/edit"] },
  { id: "S-03", name: "取次メモ詳細", nav: "memos", paths: ["/memos/:id{[0-9]+}"] },
  { id: "S-05", name: "会社一覧", nav: "companies", paths: ["/companies"], built: true },
  {
    id: "S-07",
    name: "会社登録・編集",
    nav: "companies",
    paths: ["/companies/new", "/companies/:id{[0-9]+}/edit"],
    built: true,
  },
  { id: "S-06", name: "会社詳細", nav: "companies", paths: ["/companies/:id{[0-9]+}"], built: true },
  {
    id: "S-09",
    name: "担当者登録・編集",
    nav: "companies",
    paths: ["/companies/:id{[0-9]+}/contacts/new", "/contacts/:id{[0-9]+}/edit"],
    built: true,
  },
  { id: "S-08", name: "担当者詳細", nav: "companies", paths: ["/contacts/:id{[0-9]+}"], built: true },
  { id: "S-10", name: "宛先一覧", nav: "recipients", paths: ["/recipients"], built: true },
  {
    id: "S-11",
    name: "宛先追加・編集",
    nav: "recipients",
    paths: ["/recipients/new", "/recipients/:id{[0-9]+}/edit"],
    built: true,
  },
];

export function screen(id: ScreenId): Screen {
  return SCREENS.find((s) => s.id === id) as Screen;
}
