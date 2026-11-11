// S-10 宛先一覧

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

function cookiesOf(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((h) => h.split(";")[0])
    .join("; ");
}

// 一覧の行（表示名・メールアドレス・更新者・更新日時）
function rows(html: string): string[][] {
  const table = html.split('data-table="recipients"')[1]?.split("</table>")[0] ?? "";
  const body = table.split("<tbody>")[1] ?? "";
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    ["displayName", "email", "updatedBy", "updatedAt"].map((f) => {
      const td = new RegExp(String.raw`data-field="${f}"[^>]*>([\s\S]*?)</td>`).exec(m[1] as string);
      return td ? (td[1] as string).replace(/<[^>]+>/g, "").trim() : "";
    }),
  );
}

describe("S-10 宛先一覧", () => {
  it("画面名・メニューの現在地・「宛先を追加」・列見出し・行ごとの「編集」「削除」", async () => {
    useSeed("AC-42");
    const { status, html } = await page("/recipients");
    expect(status).toBe(200);
    expect(html).toContain("<title>宛先一覧</title>");
    expect(html).toMatch(/href="\/recipients" class="nav-item[^"]*" aria-current="page"/);
    expect(html).toMatch(/<a href="\/recipients\/new" class="btn btn-primary">宛先を追加<\/a>/);
    for (const th of ["表示名", "メールアドレス", "更新者", "更新日時"]) expect(html).toContain(`>${th}</th>`);
    for (const id of [1, 2, 3]) {
      expect(html).toContain(`<a href="/recipients/${id}/edit" class="btn btn-plain">編集</a>`);
      expect(html).toMatch(
        new RegExp(
          String.raw`<form method="post" action="/recipients/${id}/delete"><button type="submit" class="btn btn-plain">削除する</button>`,
        ),
      );
    }
    expect(html).toContain("この宛先を削除しますか？");
    for (const id of ["Q-M23", "Q-M24"]) expect(html).toContain(`【未決】${id}`);
  });

  it("表示名・メールアドレス・更新者・更新日時（日本時間）を登録順に表示する。DB に直接登録した宛先の更新者・更新日時は空（Q-M24）", async () => {
    useSeed("AC-42");
    expect(rows((await page("/recipients")).html)).toEqual([
      ["菊地", "kikuchi@example.com", "", ""],
      ["社長", "shacho@example.com", "", ""],
      ["木村", "kimura@example.com", "菊地", "2026/11/02 10:00"],
    ]);
  });

  it("AC-43：削除すると S-10 に戻り「宛先を削除しました」。一覧に出ない。宛先と取次メモのデータは残る", async () => {
    useSeed("AC-43");
    const before = Date.now();
    const res = await post("/recipients/3/delete", {}, "mock_user=2");
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/recipients");
    const { html } = await page("/recipients", cookiesOf(res));
    expect(html).toContain('role="status">宛先を削除しました</p>');
    expect(rows(html).map((r) => r[0])).toEqual(["菊地", "社長"]);
    const kimura = getStore().recipients.find((r) => r.id === 3);
    expect(kimura).toMatchObject({ displayName: "木村", email: "kimura@example.com", deleted: true, updatedBy: 2 });
    expect(Date.parse(kimura?.updatedAt ?? "")).toBeGreaterThanOrEqual(before - 1000);
    expect(getStore().memos).toEqual([expect.objectContaining({ id: 1, recipientId: 3, deleted: false })]);
  });

  it("削除した宛先の取次可否は残し、S-06 には表示しない", async () => {
    useSeed("AC-43");
    const data = getStore();
    data.companies.push({
      id: 1,
      name: "マイナビ",
      kana: "まいなび",
      memo: "",
      deleted: false,
      updatedBy: 1,
      updatedAt: "2026-11-04T15:05:00.000Z",
    });
    data.companySettings.push({
      companyId: 1,
      recipientId: 3,
      value: "decline",
      updatedBy: 1,
      updatedAt: "2026-11-04T15:05:00.000Z",
    });
    expect((await page("/companies/1")).html).toContain('<label for="field-setting-3">木村</label>');
    await post("/recipients/3/delete", {});
    expect((await page("/companies/1")).html).not.toContain("field-setting-3");
    expect(getStore().companySettings).toHaveLength(1);
  });

  it("宛先が0件なら一覧の表を出さない（Q-M23）", async () => {
    useSeed("AC-29");
    for (const r of getStore().recipients) r.deleted = true;
    const { html } = await page("/recipients");
    expect(html).not.toContain('data-table="recipients"');
    expect(html).toContain("宛先を追加");
  });

  it("存在しない・削除された宛先の削除は 404", async () => {
    replaceStore(buildDemoData());
    useSeed("AC-43");
    await post("/recipients/3/delete", {});
    expect((await post("/recipients/3/delete", {})).status).toBe(404);
    expect((await post("/recipients/999/delete", {})).status).toBe(404);
  });
});

// プルダウンの選択肢（値・表示）
function options(html: string): string[][] {
  const select = html.split('<select id="field-userId"')[1]?.split("</select>")[0] ?? "";
  return [...select.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((m) => [
    m[1] as string,
    m[2] as string,
  ]);
}

describe("S-11 宛先追加・編集", () => {
  it("追加は「利用者」のプルダウンだけ。未選択で開き、既に宛先の利用者は出さない", async () => {
    useSeed("AC-29");
    const { status, html } = await page("/recipients/new");
    expect(status).toBe(200);
    expect(html).toContain("<title>宛先追加・編集</title>");
    expect(html).toMatch(/href="\/recipients" class="nav-item[^"]*" aria-current="page"/);
    expect(html).toContain('<label for="field-userId" class="mb-1 block text-sm">利用者</label>');
    expect(html).not.toContain("field-displayName");
    // 宛先「菊地」は利用者「菊地」と同じメールアドレスなので出さない
    expect(options(html)).toEqual([
      ["", ""],
      ["2", "益岡"],
      ["3", "木村"],
    ]);
    expect(html).toContain('<option value="" selected="">');
    expect(html).toMatch(/<button type="submit" class="btn btn-primary">保存<\/button>/);
    expect(html).toContain("novalidate");
    expect(html).not.toMatch(/required|maxlength|pattern=/);
    for (const id of ["Q-M15", "Q-M16", "Q-M25"]) expect(html).toContain(`【未決】${id}`);
  });

  it("削除された宛先の利用者もプルダウンに出さない", async () => {
    useSeed("AC-43");
    await post("/recipients/3/delete", {});
    expect(options((await page("/recipients/new")).html).map((o) => o[1])).toEqual(["", "益岡"]);
  });

  it("AC-29：「木村」を選んで保存すると S-10 に戻り「宛先を登録しました」。表示名は利用者の名前、メールアドレスは利用者のもの", async () => {
    useSeed("AC-29");
    const before = Date.now();
    const res = await post("/recipients/new", { userId: "3" }, "mock_user=2");
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/recipients");
    const { html } = await page("/recipients", `mock_user=2; ${cookiesOf(res)}`);
    expect(html).toContain('role="status">宛先を登録しました</p>');
    const kimura = rows(html).find((r) => r[0] === "木村");
    expect(kimura?.slice(0, 3)).toEqual(["木村", "kimura@example.com", "益岡"]);
    expect(kimura?.[3]).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
    const added = getStore().recipients.find((r) => r.email === "kimura@example.com");
    expect(added).toMatchObject({ id: 3, displayName: "木村", deleted: false, updatedBy: 2 });
    expect(Date.parse(added?.updatedAt ?? "")).toBeGreaterThanOrEqual(before - 1000);
    // 追加した利用者は、次からプルダウンに出ない
    expect(options((await page("/recipients/new")).html).map((o) => o[1])).toEqual(["", "益岡"]);
  });

  it("利用者を選ばずに保存すると「利用者は必須です」。保存しない", async () => {
    useSeed("AC-29");
    const res = await post("/recipients/new", { userId: "" });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="field-userId-error"><p class="error-text mt-1 text-sm">利用者は必須です</p>');
    expect(html).toMatch(/id="field-userId"[^>]*class="select w-full max-w-xl select-error"[^>]*aria-invalid="true"/);
    expect(getStore().recipients).toHaveLength(2);
  });

  it("既に宛先の利用者が送られても追加しない（二重登録を防ぐ。仮。Q-M25）", async () => {
    useSeed("AC-29");
    const html = await (await post("/recipients/new", { userId: "1" })).text();
    expect(html).toContain("利用者は必須です");
    expect(getStore().recipients).toHaveLength(2);
  });

  it("AC-42：編集は表示名だけで、登録済みの値で開く。「木村（営業）」にして保存すると S-10 に戻り「宛先を更新しました」", async () => {
    useSeed("AC-42");
    const form = await page("/recipients/3/edit");
    expect(form.status).toBe(200);
    expect(form.html).toContain('<label for="field-displayName" class="mb-1 block text-sm">表示名</label>');
    expect(form.html).toContain('value="木村"');
    expect(form.html).not.toContain("field-userId");
    expect(form.html).not.toContain("【未決】Q-M25");

    const res = await post("/recipients/3/edit", { displayName: "木村（営業）" }, "mock_user=2");
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/recipients");
    const { html } = await page("/recipients", cookiesOf(res));
    expect(html).toContain('role="status">宛先を更新しました</p>');
    expect(rows(html).map((r) => r[0])).toEqual(["菊地", "社長", "木村（営業）"]);
    // メールアドレスは変えない
    expect(getStore().recipients[2]).toMatchObject({
      displayName: "木村（営業）",
      email: "kimura@example.com",
      updatedBy: 2,
    });
  });

  it("表示名が空なら「表示名は必須です」、256文字なら「表示名は255文字以内で入力してください」。入力した値は残し、保存しない", async () => {
    useSeed("AC-42");
    const empty = await (await post("/recipients/3/edit", { displayName: "　" })).text();
    expect(empty).toContain('id="field-displayName-error"><p class="error-text mt-1 text-sm">表示名は必須です</p>');
    const long = await (await post("/recipients/3/edit", { displayName: "あ".repeat(256) })).text();
    expect(long).toContain("表示名は255文字以内で入力してください");
    expect(long).toContain(`value="${"あ".repeat(256)}"`);
    expect(getStore().recipients[2]).toMatchObject({ displayName: "木村", updatedBy: 1 });
  });

  it("表示名は前後の空白を削って保存する（Q-M11）", async () => {
    useSeed("AC-42");
    await post("/recipients/3/edit", { displayName: " 木村（営業）　" });
    expect(getStore().recipients[2]?.displayName).toBe("木村（営業）");
  });

  it("存在しない・削除された宛先の編集は 404", async () => {
    useSeed("AC-43");
    await post("/recipients/3/delete", {});
    expect((await page("/recipients/3/edit")).status).toBe(404);
    expect((await post("/recipients/3/edit", { displayName: "木村" })).status).toBe(404);
    expect((await page("/recipients/999/edit")).status).toBe(404);
  });
});

describe("S-10 のシード", () => {
  it.each(["AC-29", "AC-42", "AC-43"])("%s は益岡で S-10 宛先一覧を開く", async (name) => {
    const res = await app.request(`${BASE}/__seed/${name}`, {}, mockEnv);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/recipients");
    expect(res.headers.getSetCookie().join(";")).toContain("mock_user=2");
  });

  it("AC-29 は利用者「木村」が宛先ではない。AC-42・AC-43 は宛先「木村」がいて、AC-43 は木村宛ての取次メモが1件", () => {
    useSeed("AC-29");
    expect(getStore().users.map((u) => u.name)).toContain("木村");
    expect(getStore().recipients.map((r) => r.email)).not.toContain("kimura@example.com");
    useSeed("AC-42");
    expect(getStore().recipients.find((r) => r.id === 3)).toMatchObject({ displayName: "木村", deleted: false });
    expect(getStore().memos).toHaveLength(0);
    useSeed("AC-43");
    expect(getStore().memos.map((m) => m.recipientId)).toEqual([3]);
  });
});
