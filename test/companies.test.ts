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

// <dd data-field="x">…</dd> の中身
function field(html: string, name: string, scope = html): string {
  const m = new RegExp(String.raw`data-field="${name}"[^>]*>([\s\S]*?)</(dd|td)>`).exec(scope);
  return m ? (m[1] as string).replace(/<[^>]+>/g, "").trim() : "";
}

// 取次可否の行（宛先・選んでいる値・更新者・更新日時）
function settingRows(html: string): string[][] {
  const table = html.split('data-table="settings"')[1]?.split("</table>")[0] ?? "";
  const body = table.split("<tbody>")[1] ?? "";
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => {
    const row = m[1] as string;
    const recipient = (/<label[^>]*>([^<]*)<\/label>/.exec(row)?.[1] ?? "").trim();
    const selected = /<option value="[^"]*" selected="">([^<]*)<\/option>/.exec(row)?.[1] ?? "";
    return [recipient, selected, field(row, "updatedBy", row), field(row, "updatedAt", row)];
  });
}

describe("S-06 会社詳細", () => {
  it("AC-21 の続き：会社の情報・更新者・更新日時（日本時間・分単位）を表示する", async () => {
    useSeed("AC-21");
    const res = await post("/companies/new", { name: "マイナビ", kana: "まいなび", memo: "" }, "mock_user=1");
    const cookie = res.headers
      .getSetCookie()
      .map((h) => h.split(";")[0])
      .join("; ");
    const { status, html } = await page("/companies/1", cookie);
    expect(status).toBe(200);
    expect(html).toContain("<title>会社詳細</title>");
    expect(html).toContain("会社を登録しました");
    expect(field(html, "name")).toBe("マイナビ");
    expect(field(html, "kana")).toBe("まいなび");
    expect(field(html, "updatedBy")).toBe("菊地");
    expect(field(html, "updatedAt")).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  });

  it("更新日時は日本時間で表示する", async () => {
    useSeed("AC-25");
    for (const c of getStore().companies) c.updatedAt = "2026-11-04T15:05:00.000Z";
    expect(field((await page("/companies/1")).html, "updatedAt")).toBe("2026/11/05 00:05");
  });

  it("「編集」「削除」「担当者を追加」ボタンと削除の確認ダイアログ", async () => {
    useSeed("AC-25");
    const { html } = await page("/companies/1");
    expect(html).toMatch(/<a href="\/companies\/1\/edit" class="btn btn-plain">編集<\/a>/);
    expect(html).toMatch(/<a href="\/companies\/1\/contacts\/new" class="btn btn-plain">担当者を追加<\/a>/);
    expect(html).toContain(">削除</button>");
    expect(html).toContain("この会社を削除しますか？ 所属する担当者も削除されます");
    expect(html).toMatch(
      /<form method="post" action="\/companies\/1\/delete"><button type="submit" class="btn btn-plain">削除する<\/button>/,
    );
  });

  it("会社名が空の会社は、会社名の代わりによみがなを表示する", async () => {
    replaceStore(buildDemoData());
    expect(field((await page("/companies/7")).html, "name")).toBe("やまびこでんき");
  });

  it("担当者一覧：担当者名（空ならよみがな）と電話番号。削除された担当者は表示しない。S-08 へリンク", async () => {
    replaceStore(buildDemoData());
    const t5 = (await page("/companies/9")).html.split('data-table="contacts"')[1] ?? "";
    expect(t5).toContain('<a href="/contacts/11" class="link">吉田　恵</a>');
    expect(t5).toContain("まつもと");
    expect(t5).toContain("0337778888");
    // 北斗電工（4）の木下さん（15）は削除済み
    const t4 = (await page("/companies/4")).html.split('data-table="contacts"')[1] ?? "";
    expect(t4).toContain("渡辺　大輔");
    expect(t4).not.toContain("木下");
  });

  it("担当者0人なら担当者の表を出さない（Q-M18）", async () => {
    useSeed("AC-69");
    expect((await page("/companies/1")).html).not.toContain('data-table="contacts"');
  });

  it("宛先ごとの取次可否：初期値は未設定。一度も保存していなければ更新者・更新日時は空（Q-M19）", async () => {
    useSeed("AC-27");
    expect(settingRows((await page("/companies/1")).html)).toEqual([
      ["菊地", "未設定", "", ""],
      ["社長", "未設定", "", ""],
    ]);
  });

  it("AC-27：「つながない」にして保存すると S-06 にとどまり「取次可否を更新しました」。値・更新者・更新日時を表示する", async () => {
    useSeed("AC-27");
    const res = await post("/companies/1/settings", { "setting-1": "decline", "setting-2": "unset" }, "mock_user=1");
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/companies/1");
    const cookie = res.headers
      .getSetCookie()
      .map((h) => h.split(";")[0])
      .join("; ");
    const { html } = await page("/companies/1", cookie);
    expect(html).toContain("取次可否を更新しました");
    const [kikuchi, shacho] = settingRows(html);
    expect(kikuchi?.slice(0, 3)).toEqual(["菊地", "つながない", "菊地"]);
    expect(kikuchi?.[3]).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
    // 値を変えていない宛先は記録しない（仮。Q-M17）
    expect(shacho).toEqual(["社長", "未設定", "", ""]);
    expect(getStore().companySettings).toHaveLength(1);
  });

  it("代理で設定すると、更新者はログイン中の利用者", async () => {
    useSeed("AC-27");
    await post("/companies/1/settings", { "setting-2": "connect" }, "mock_user=2");
    expect(getStore().companySettings).toEqual([
      expect.objectContaining({ recipientId: 2, value: "connect", updatedBy: 2 }),
    ]);
  });

  it("不正な値・知らない宛先は無視する", async () => {
    useSeed("AC-27");
    await post("/companies/1/settings", { "setting-1": "つなぐ", "setting-9": "decline" });
    expect(getStore().companySettings).toHaveLength(0);
  });

  it("削除された宛先の取次可否は表示しない", async () => {
    useSeed("AC-27");
    getStore().recipients.push({
      id: 3,
      displayName: "木村",
      email: "kimura@example.com",
      deleted: true,
      updatedBy: null,
      updatedAt: null,
    });
    expect(settingRows((await page("/companies/1")).html).map((r) => r[0])).toEqual(["菊地", "社長"]);
  });

  it("AC-24：削除すると S-05 に戻り「会社を削除しました」。会社と担当者は論理削除、取次メモは残る", async () => {
    useSeed("AC-24");
    const res = await post("/companies/1/delete", {}, "mock_user=1");
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/companies");
    const cookie = res.headers
      .getSetCookie()
      .map((h) => h.split(";")[0])
      .join("; ");
    const { html } = await page("/companies", cookie);
    expect(html).toContain("会社を削除しました");
    expect(rows(html)).toEqual([]);
    const s = getStore();
    expect(s.companies[0]).toMatchObject({ deleted: true, updatedBy: 1 });
    expect(s.contacts[0]).toMatchObject({ deleted: true, updatedBy: 1 });
    expect(s.memos[0]).toMatchObject({ deleted: false, companyName: "マイナビ" });
    // 削除した会社の詳細・編集は開けない
    expect((await page("/companies/1")).status).toBe(404);
  });

  it("存在しない・削除された会社は 404", async () => {
    replaceStore(buildDemoData());
    expect((await page("/companies/999")).status).toBe(404);
    expect((await page("/companies/11")).status).toBe(404);
    expect((await post("/companies/11/settings", { "setting-1": "decline" })).status).toBe(404);
    expect((await post("/companies/11/delete", {})).status).toBe(404);
  });
});

describe("S-06 のシード", () => {
  it.each(["AC-24", "AC-27", "AC-25", "AC-61", "AC-69"])("%s は菊地で S-06（会社 1）を開く", async (name) => {
    const res = await app.request(`${BASE}/__seed/${name}`, {}, mockEnv);
    expect(res.headers.get("Location")).toBe("/companies/1");
    expect(res.headers.getSetCookie().join(";")).toContain("mock_user=1");
  });
});
