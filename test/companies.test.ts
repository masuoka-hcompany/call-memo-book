// S-05 会社一覧

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

function post(path: string, form: Record<string, string>, cookie?: string) {
  return app.request(
    `${BASE}${path}`,
    {
      method: "POST",
      body: new URLSearchParams(form),
      headers: { Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) },
    },
    mockEnv,
  );
}

describe("S-07 会社登録・編集", () => {
  it("登録はすべて空欄で開き、項目名・「保存」ボタンを表示する。ブラウザの入力チェックは使わない", async () => {
    useSeed("AC-23");
    const { status, html } = await page("/companies/new");
    expect(status).toBe(200);
    expect(html).toContain("<title>会社登録・編集</title>");
    expect(html).toMatch(/href="\/companies" class="nav-item[^"]*" aria-current="page"/);
    expect(html).toContain('<label for="field-name" class="mb-1 block text-sm">会社名</label>');
    expect(html).toContain('<label for="field-kana" class="mb-1 block text-sm">会社名のよみがな</label>');
    expect(html).toContain('<label for="field-memo" class="mb-1 block text-sm">メモ</label>');
    expect(html).toMatch(/<button type="submit" class="btn btn-primary">保存<\/button>/);
    expect(html).toContain("novalidate");
    expect(html).not.toMatch(/required|maxlength|pattern=/);
    expect(html).not.toContain("error-text");
  });

  it("AC-55：何も入力せずに保存すると、よみがな欄だけに「会社名のよみがなは必須です」。保存しない", async () => {
    useSeed("AC-55");
    const res = await post("/companies/new", { name: "", kana: "", memo: "" });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="field-kana-error"><p class="error-text mt-1 text-sm">会社名のよみがなは必須です</p>');
    expect(html).not.toContain("field-name-error");
    expect(html).toMatch(/id="field-kana"[^>]*class="input w-full max-w-xl input-error"[^>]*aria-invalid="true"/);
    expect(getStore().companies).toHaveLength(0);
  });

  it("AC-23：よみがながカタカナならエラー。入力した値は残す。保存しない", async () => {
    useSeed("AC-23");
    const html = await (await post("/companies/new", { name: "マイナビ", kana: "マイナビ", memo: "" })).text();
    expect(html).toContain("会社名のよみがなはひらがなで入力してください");
    expect(html).toContain('value="マイナビ"');
    expect(getStore().companies).toHaveLength(0);
  });

  it("AC-56：会社名が256文字ならエラー。保存しない", async () => {
    useSeed("AC-56");
    const html = await (await post("/companies/new", { name: "あ".repeat(256), kana: "てすと", memo: "" })).text();
    expect(html).toContain(
      'id="field-name-error"><p class="error-text mt-1 text-sm">会社名は255文字以内で入力してください</p>',
    );
    expect(getStore().companies).toHaveLength(0);
  });

  it("1つの欄の複数のエラーを1行ずつ表示する（Q-M09）", async () => {
    useSeed("AC-23");
    const html = await (await post("/companies/new", { name: "", kana: "ア".repeat(256), memo: "" })).text();
    expect(html).toContain(
      '<p class="error-text mt-1 text-sm">会社名のよみがなはひらがなで入力してください</p><p class="error-text mt-1 text-sm">会社名のよみがなは255文字以内で入力してください</p>',
    );
  });

  it("AC-21：登録すると S-06 会社詳細に移り「会社を登録しました」。更新者・更新日時を記録する", async () => {
    useSeed("AC-21");
    const before = Date.now();
    const res = await post("/companies/new", { name: "マイナビ", kana: "まいなび", memo: "" }, "mock_user=1");
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/companies/1");
    expect(res.headers.getSetCookie().join(";")).toContain("flash=companyCreated");
    const [company] = getStore().companies;
    expect(company).toMatchObject({
      id: 1,
      name: "マイナビ",
      kana: "まいなび",
      memo: "",
      deleted: false,
      updatedBy: 1,
    });
    expect(Date.parse(company?.updatedAt ?? "")).toBeGreaterThanOrEqual(before - 1000);
  });

  it("AC-22：同じ会社名の会社も登録でき、S-05 に2行表示される", async () => {
    useSeed("AC-22");
    const res = await post("/companies/new", { name: "マイナビ", kana: "まいなび", memo: "" });
    expect(res.headers.get("Location")).toBe("/companies/2");
    expect(rows((await page("/companies")).html).filter((r) => r[0] === "マイナビ")).toHaveLength(2);
  });

  it("AC-68：会社名が空でも登録でき、S-05 に会社名の代わりによみがなを表示する", async () => {
    useSeed("AC-68");
    const res = await post("/companies/new", { name: "", kana: "みいだす", memo: "" });
    expect(res.status).toBe(303);
    expect(rows((await page("/companies")).html)).toEqual([["みいだす", "みいだす", "0"]]);
  });

  it("会社名・よみがなは前後の空白を削って保存する。メモは削らない（Q-M11）", async () => {
    useSeed("AC-21");
    await post("/companies/new", { name: " マイナビ　", kana: "\tまいなび ", memo: " 採用媒体\r\n" });
    expect(getStore().companies[0]).toMatchObject({ name: "マイナビ", kana: "まいなび", memo: " 採用媒体\r\n" });
  });

  it("AC-39：編集は登録済みの値で開き、保存すると「会社を更新しました」。更新者は益岡", async () => {
    useSeed("AC-39");
    const form = await page("/companies/1/edit", "mock_user=2");
    expect(form.html).toContain('value="マイナビ"');
    expect(form.html).toContain('value="まいなび"');

    const res = await post(
      "/companies/1/edit",
      { name: "マイナビ", kana: "まいなび", memo: "採用媒体" },
      "mock_user=2",
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/companies/1");
    expect(res.headers.getSetCookie().join(";")).toContain("flash=companyUpdated");
    expect(getStore().companies[0]).toMatchObject({ memo: "採用媒体", updatedBy: 2 });
  });

  it("編集でエラーなら保存しない", async () => {
    useSeed("AC-39");
    const html = await (await post("/companies/1/edit", { name: "マイナビ", kana: "", memo: "x" })).text();
    expect(html).toContain("会社名のよみがなは必須です");
    expect(getStore().companies[0]).toMatchObject({ kana: "まいなび", memo: "" });
  });

  it("メモの改行と、改行で始まる値を入力欄に残す", async () => {
    useSeed("AC-39");
    for (const company of getStore().companies) company.memo = "\n1行目\n2行目";
    const { html } = await page("/companies/1/edit");
    expect(html).toMatch(/<textarea[^>]*>\n\n1行目\n2行目<\/textarea>/);
  });

  it("存在しない・削除された会社の編集は 404", async () => {
    replaceStore(buildDemoData());
    expect((await page("/companies/999/edit")).status).toBe(404);
    // デモデータの会社 11 は削除済み
    expect((await page("/companies/11/edit")).status).toBe(404);
    expect((await post("/companies/11/edit", { name: "x", kana: "えっくす", memo: "" })).status).toBe(404);
  });
});

describe("S-07 のシード", () => {
  it.each(["AC-23", "AC-55", "AC-56"])("%s は菊地で S-07 会社登録を開く", async (name) => {
    const res = await app.request(`${BASE}/__seed/${name}`, {}, mockEnv);
    expect(res.headers.get("Location")).toBe("/companies/new");
    expect(res.headers.getSetCookie().join(";")).toContain("mock_user=1");
  });

  it("AC-39 は益岡で S-06 会社詳細（マイナビ）を開く", async () => {
    const res = await app.request(`${BASE}/__seed/AC-39`, {}, mockEnv);
    expect(res.headers.get("Location")).toBe("/companies/1");
    expect(res.headers.getSetCookie().join(";")).toContain("mock_user=2");
  });
});
