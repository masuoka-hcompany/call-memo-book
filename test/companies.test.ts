// S-05 会社一覧

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index.tsx";
import { buildDemoData, findSeed } from "../src/mock/seeds.ts";
import { replaceStore } from "../src/mock/store.ts";

const BASE = "http://localhost:8787";
const mockEnv = { ...env, ENVIRONMENT: "local", MOCK_MODE: "true" };

function useSeed(name: string) {
  const seed = findSeed(name);
  if (!seed) throw new Error(`seed ${name} not found`);
  replaceStore(seed.build());
}

async function page(path: string, cookie?: string) {
  const res = await app.request(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {} }, mockEnv);
  return { status: res.status, html: await res.text() };
}

// 一覧の行（会社名・よみがな・担当者数）を取り出す
function rows(html: string): string[][] {
  const body = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...(m[1] as string).matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((td) =>
      (td[1] as string).replace(/<[^>]+>/g, "").trim(),
    ),
  );
}

describe("S-05 会社一覧", () => {
  it("画面名・メニューの現在地・検索欄・「新規登録」ボタン・列見出し", async () => {
    useSeed("AC-57");
    const { status, html } = await page("/companies");
    expect(status).toBe(200);
    expect(html).toContain("<title>会社一覧</title>");
    expect(html).toMatch(/href="\/companies" class="nav-item[^"]*" aria-current="page"/);
    expect(html).toContain('aria-label="検索欄"');
    expect(html).toMatch(/<a href="\/companies\/new" class="btn btn-primary">新規登録<\/a>/);
    for (const th of ["会社名", "よみがな", "担当者数"]) expect(html).toContain(`>${th}</th>`);
    // ブラウザの入力チェックは使わない
    expect(html).toContain("novalidate");
    expect(html).not.toMatch(/required|maxlength|pattern=/);
  });

  it("AC-58：よみがな順に並び、担当者数を表示する", async () => {
    useSeed("AC-58");
    const { html } = await page("/companies");
    expect(rows(html)).toEqual([
      ["マイナビ", "まいなび", "2"],
      ["ミイダス", "みいだす", "0"],
    ]);
  });

  it("AC-57：「まい」で検索すると「マイナビ」だけ", async () => {
    useSeed("AC-57");
    const { html } = await page(`/companies?q=${encodeURIComponent("まい")}`);
    expect(rows(html).map((r) => r[0])).toEqual(["マイナビ"]);
    // 検索欄に入力した語が残る
    expect(html).toContain('value="まい"');
  });

  it("会社名でも検索でき、入力どおりに比べる（カタカナ「マイ」はよみがな「まいなび」に当たらない）", async () => {
    useSeed("AC-57");
    expect(rows((await page(`/companies?q=${encodeURIComponent("ダス")}`)).html).map((r) => r[0])).toEqual([
      "ミイダス",
    ]);
    expect(rows((await page(`/companies?q=${encodeURIComponent("マイ")}`)).html).map((r) => r[0])).toEqual([
      "マイナビ",
    ]);
    expect(rows((await page(`/companies?q=${encodeURIComponent("ﾏｲ")}`)).html)).toEqual([]);
  });

  it("検索欄が空・空白だけなら、すべての会社を表示する（仮。Q-M12）", async () => {
    useSeed("AC-57");
    expect(rows((await page("/companies?q=")).html)).toHaveLength(2);
    expect(rows((await page(`/companies?q=${encodeURIComponent("　")}`)).html)).toHaveLength(2);
  });

  it("0件のときは一覧を出さず【未決】バッジを出す（Q-M13）", async () => {
    useSeed("AC-21");
    const { html } = await page("/companies");
    expect(html).not.toContain("<tbody>");
    expect(html).toContain("【未決】Q-M13");
  });

  it("会社名が空の会社は、会社名の代わりによみがなを表示する", async () => {
    replaceStore(buildDemoData());
    const { html } = await page("/companies");
    expect(rows(html)).toContainEqual(["やまびこでんき", "やまびこでんき", "1"]);
  });

  it("同じ会社名の会社は別の行で表示し、削除された会社は表示しない。担当者数に削除された担当者を数えない", async () => {
    replaceStore(buildDemoData());
    const list = rows((await page("/companies")).html);
    expect(list.filter((r) => r[0] === "東和建設")).toHaveLength(2);
    expect(list.map((r) => r[0])).not.toContain("大河内住宅");
    // 北斗電工は担当者2人のうち1人が削除済み
    expect(list.find((r) => r[0] === "北斗電工")?.[2]).toBe("1");
    expect(list).toHaveLength(10);
  });

  it("会社名から S-06 会社詳細へリンクする", async () => {
    useSeed("AC-57");
    const { html } = await page("/companies");
    expect(html).toMatch(/<a href="\/companies\/1" class="link">マイナビ<\/a>/);
  });

  it("「会社を削除しました」を表示できる（S-06 から戻ったとき）", async () => {
    useSeed("AC-57");
    const { html } = await page("/companies", "flash=companyDeleted");
    expect(html).toContain("会社を削除しました");
  });

  it("キーワードの HTML はエスケープする", async () => {
    useSeed("AC-57");
    const { html } = await page(`/companies?q=${encodeURIComponent('"><script>')}`);
    expect(html).not.toContain('"><script>');
  });
});

describe("S-05 のシード", () => {
  it.each(["AC-21", "AC-22", "AC-57", "AC-58", "AC-68"])("%s は菊地で S-05 を開く", async (name) => {
    const res = await app.request(`${BASE}/__seed/${name}`, {}, mockEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/companies");
    expect(res.headers.getSetCookie().join(";")).toContain("mock_user=1");
  });
});
