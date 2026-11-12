// S-01 相手検索

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index.tsx";
import { buildDemoData, findSeed } from "../src/mock/seeds.ts";
import { getStore, replaceStore } from "../src/mock/store.ts";

const BASE = "http://localhost:8787";
const mockEnv = { ...env, ENVIRONMENT: "local", MOCK_MODE: "true" };

function useSeed(name: string) {
  const seed = findSeed(name);
  if (!seed) throw new Error(`seed ${name} not found`);
  replaceStore(seed.build());
}

async function page(path: string) {
  const res = await app.request(`${BASE}${path}`, {}, mockEnv);
  return { status: res.status, html: await res.text() };
}

const q = (keyword: string, extra = "") => `/?q=${encodeURIComponent(keyword)}${extra}`;
const text = (s: string) => s.replace(/<[^>]+>/g, "").trim();

// 検索結果の行（会社名・担当者名・電話番号、選択中か）
function results(html: string): { cells: string[]; selected: boolean; href: string }[] {
  const table = html.split('data-table="results"')[1]?.split("</table>")[0] ?? "";
  const body = table.split("<tbody>")[1] ?? "";
  return [...body.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)].map((m) => ({
    cells: [...(m[2] as string).matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((td) => text(td[1] as string)),
    selected: (m[1] as string).includes("row-selected") && (m[2] as string).includes('aria-current="true"'),
    href: (/href="([^"]*)"/.exec(m[2] as string)?.[1] ?? "").replaceAll("&amp;", "&"),
  }));
}

// 取次可否の行（宛先・判定・内訳）
function settings(html: string): string[][] {
  const table = html.split('data-table="settings"')[1]?.split("</table>")[0] ?? "";
  return [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    ["recipient", "verdict", "breakdown"].map((f) => {
      const cell = new RegExp(String.raw`data-field="${f}"[^>]*>([\s\S]*?)</t[dh]>`).exec(m[1] as string);
      return cell ? text(cell[1] as string) : "";
    }),
  );
}

describe("S-01 相手検索", () => {
  it("画面名・メニューの現在地・検索欄（大）・「取次メモを作成」。開いたときは検索結果を出さない", async () => {
    useSeed("AC-35");
    const { status, html } = await page("/");
    expect(status).toBe(200);
    expect(html).toContain("<title>相手検索</title>");
    expect(html).toMatch(/href="\/" class="nav-item[^"]*" aria-current="page"/);
    expect(html).toMatch(/<input type="search" name="q" value="" class="input input-lg w-full" aria-label="検索欄"/);
    expect(html).toContain(">検索</button>");
    expect(html).toMatch(/<a href="\/memos\/new" class="btn btn-primary">取次メモを作成<\/a>/);
    expect(html).not.toContain('data-table="results"');
    expect(html).not.toContain("該当する相手が見つかりません");
    expect(html).toContain("novalidate");
    expect(html).not.toMatch(/required|maxlength|pattern=/);
    for (const id of ["Q-M10", "Q-M26", "Q-M27"]) expect(html).toContain(`【未決】${id}`);
  });

  it("AC-01：「原」で、マイナビ／原田／0312345678 の行", async () => {
    useSeed("AC-01");
    const { html } = await page(q("原"));
    expect(results(html).map((r) => r.cells)).toEqual([["マイナビ", "原田", "0312345678"]]);
    // 検索欄に入力した語が残る
    expect(html).toContain('value="原"');
  });

  it("AC-02：「まいな」で、マイナビ／原田 と マイナビ／佐藤", async () => {
    useSeed("AC-02");
    expect(results((await page(q("まいな"))).html).map((r) => r.cells.slice(0, 2))).toEqual([
      ["マイナビ", "原田"],
      ["マイナビ", "佐藤"],
    ]);
  });

  it("AC-03：「マイナビ／原田」を選ぶと、宛先ごとに判定と、担当者・会社の取次可否を並べて表示する", async () => {
    useSeed("AC-03");
    const list = await page(q("原田"));
    expect(list.html).not.toContain('data-section="settings"');
    const [row] = results(list.html);
    expect(row?.href).toBe(q("原田", "&contact=1"));

    const { html } = await page(row?.href ?? "");
    expect(results(html)[0]?.selected).toBe(true);
    expect(html).toContain("宛先ごとの取次可否");
    expect(settings(html)).toEqual([
      ["菊地", "✕ つながない", "担当者：つながない ← 採用　／　会社：未設定"],
      ["社長", "● つなぐ", "担当者：つなぐ ← 採用　／　会社：つなぐ"],
    ]);
    // 採用された方は太字（source-adopted）
    expect(html).toContain('<span class="source-adopted">担当者：つながない ← 採用</span>');
    expect(html).toContain('<span class="verdict verdict-ng">✕ つながない</span>');
    // 「取次メモを作成」は選んだ担当者を渡す
    expect(html).toMatch(/<a href="\/memos\/new\?contact=1" class="btn btn-primary">取次メモを作成<\/a>/);
    for (const id of ["Q-M01", "Q-M02"]) expect(html).toContain(`【未決】${id}`);
  });

  it("担当者が「未設定」なら会社の値を採用する", async () => {
    useSeed("AC-03");
    getStore().contactSettings = [];
    expect(settings((await page(q("原田", "&contact=1"))).html)).toEqual([
      ["菊地", "― 未設定", "担当者：未設定　／　会社：未設定 ← 採用"],
      ["社長", "● つなぐ", "担当者：未設定　／　会社：つなぐ ← 採用"],
    ]);
  });

  it("AC-04：0件なら「該当する相手が見つかりません」と「取次メモを作成」（空欄で開く）", async () => {
    useSeed("AC-04");
    const { html } = await page(q("ミイダス"));
    expect(html).toContain('data-testid="not-found">該当する相手が見つかりません</p>');
    expect(html).toMatch(/<a href="\/memos\/new" class="btn btn-primary">取次メモを作成<\/a>/);
    expect(html).not.toContain('data-table="results"');
  });

  it("AC-35：検索欄が空のまま（空白だけも）検索すると、一覧も0件の表示も出さない", async () => {
    useSeed("AC-35");
    for (const k of ["", "　 "]) {
      const { html } = await page(q(k));
      expect(html).not.toContain('data-table="results"');
      expect(html).not.toContain("該当する相手が見つかりません");
    }
  });

  it("AC-44：電話番号「12345」で、マイナビ／原田／0312345678", async () => {
    useSeed("AC-44");
    expect(results((await page(q("12345"))).html).map((r) => r.cells)).toEqual([["マイナビ", "原田", "0312345678"]]);
  });

  it("AC-45：「マイナ」で担当者全員", async () => {
    useSeed("AC-45");
    expect(results((await page(q("マイナ"))).html).map((r) => r.cells)).toEqual([
      ["マイナビ", "原田", "0312345678"],
      ["マイナビ", "佐藤", "0398765432"],
    ]);
  });

  it("AC-46：担当者のいない会社は会社だけの行。選ぶと会社の取次可否だけを表示する", async () => {
    useSeed("AC-46");
    const [row] = results((await page(q("ミイダス"))).html);
    expect(row?.cells).toEqual(["ミイダス", "", ""]);
    expect(row?.href).toBe(q("ミイダス", "&company=1"));
    const { html } = await page(row?.href ?? "");
    expect(results(html)[0]?.selected).toBe(true);
    expect(settings(html)).toEqual([
      ["菊地", "✕ つながない", "会社：つながない"],
      ["社長", "● つなぐ", "会社：つなぐ"],
    ]);
    expect(html).not.toContain("担当者：");
    expect(html).toMatch(/<a href="\/memos\/new\?company=1" class="btn btn-primary">取次メモを作成<\/a>/);
  });

  it("AC-47：削除された担当者は出さない", async () => {
    useSeed("AC-47");
    expect(results((await page(q("マイナ"))).html).map((r) => r.cells[1])).toEqual(["佐藤"]);
    // URL で削除済みの担当者を指定しても選ばない
    expect((await page(q("マイナ", "&contact=1"))).html).not.toContain('data-section="settings"');
  });

  it("AC-48：削除された宛先の取次可否は出さない", async () => {
    useSeed("AC-48");
    expect(settings((await page(q("原田", "&contact=1"))).html).map((r) => r[0])).toEqual(["菊地", "社長"]);
  });

  it("会社名・担当者名が空なら、名前の代わりによみがなを表示する", async () => {
    useSeed("AC-45");
    const [company] = getStore().companies;
    const [harada] = getStore().contacts;
    if (!company || !harada) throw new Error("seed");
    company.name = "";
    harada.name = "";
    expect(results((await page(q("まいな"))).html).map((r) => r.cells.slice(0, 2))).toEqual([
      ["まいなび", "はらだ"],
      ["まいなび", "佐藤"],
    ]);
  });

  it("検索結果にない相手を URL で指定しても選ばない", async () => {
    useSeed("AC-45");
    expect((await page(q("佐藤", "&contact=1"))).html).not.toContain('data-section="settings"');
    expect((await page(q("佐藤", "&company=1"))).html).not.toContain('data-section="settings"');
  });

  it("キーワードの HTML はエスケープする", async () => {
    useSeed("AC-04");
    const { html } = await page(q('<script>"'));
    expect(html).not.toContain('<script>"');
  });

  it("デモデータ：同じ会社名の別の会社を、担当者名・電話番号で見分けられる", async () => {
    replaceStore(buildDemoData());
    const rows = results((await page(q("東和"))).html);
    expect(new Set(rows.map((r) => r.cells[0]))).toEqual(new Set(["東和建設"]));
    expect(new Set(rows.map((r) => r.href)).size).toBe(rows.length);
  });
});

describe("S-01 のシード", () => {
  it.each(["AC-01", "AC-02", "AC-04", "AC-35", "AC-44", "AC-45", "AC-46", "AC-47"])(
    "%s は菊地で S-01 を開く",
    async (name) => {
      const res = await app.request(`${BASE}/__seed/${name}`, {}, mockEnv);
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("/");
      expect(res.headers.getSetCookie().join(";")).toContain("mock_user=1");
    },
  );

  it.each(["AC-03", "AC-48"])("%s は「原田」を検索した S-01 を開く", async (name) => {
    const res = await app.request(`${BASE}/__seed/${name}`, {}, mockEnv);
    expect(res.headers.get("Location")).toBe(q("原田"));
  });

  it("AC-48 は削除済みの宛先「木村」がいる", () => {
    useSeed("AC-48");
    expect(getStore().recipients.map((r) => [r.displayName, r.deleted])).toEqual([
      ["菊地", false],
      ["社長", false],
      ["木村", true],
    ]);
  });
});
