// S-09 担当者登録・編集

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

// S-06 の担当者一覧の行（担当者名・電話番号）
function contactRows(html: string): string[][] {
  const table = html.split('data-table="contacts"')[1]?.split("</table>")[0] ?? "";
  const body = table.split("<tbody>")[1] ?? "";
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...(m[1] as string).matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((td) =>
      (td[1] as string).replace(/<[^>]+>/g, "").trim(),
    ),
  );
}

const NEW = "/companies/1/contacts/new";
const form = (v: Partial<Record<"name" | "kana" | "phone" | "memo", string>>) => ({
  name: "",
  kana: "",
  phone: "",
  memo: "",
  ...v,
});

describe("S-09 担当者登録・編集", () => {
  it("登録はすべて空欄で開き、項目名・「保存」ボタンを表示する。ブラウザの入力チェックは使わない", async () => {
    useSeed("AC-59");
    const { status, html } = await page(NEW);
    expect(status).toBe(200);
    expect(html).toContain("<title>担当者登録・編集</title>");
    expect(html).toMatch(/href="\/companies" class="nav-item[^"]*" aria-current="page"/);
    expect(html).toContain('<label for="field-name" class="mb-1 block text-sm">担当者名</label>');
    expect(html).toContain('<label for="field-kana" class="mb-1 block text-sm">担当者名のよみがな</label>');
    expect(html).toContain('<label for="field-phone" class="mb-1 block text-sm">電話番号</label>');
    expect(html).toContain('<label for="field-memo" class="mb-1 block text-sm">メモ</label>');
    expect(html).toContain(`action="${NEW}"`);
    expect(html).toMatch(/<button type="submit" class="btn btn-primary">保存<\/button>/);
    expect(html).toContain("novalidate");
    expect(html).not.toMatch(/required|maxlength|pattern=/);
    expect(html).not.toContain("error-text");
    for (const id of ["Q-M15", "Q-M16", "Q-M20"]) expect(html).toContain(`【未決】${id}`);
  });

  it("S-06 の「担当者を追加」から開ける", async () => {
    useSeed("AC-25");
    expect((await page("/companies/1")).html).toContain(`<a href="${NEW}" class="btn btn-plain">担当者を追加</a>`);
  });

  it("AC-59：何も入力せずに保存すると、よみがな欄と電話番号欄にエラー。担当者名欄には出ない。保存しない", async () => {
    useSeed("AC-59");
    const res = await post(NEW, form({}));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="field-kana-error"><p class="error-text mt-1 text-sm">担当者名のよみがなは必須です</p>');
    expect(html).toContain('id="field-phone-error"><p class="error-text mt-1 text-sm">電話番号は必須です</p>');
    expect(html).not.toContain("field-name-error");
    expect(html).not.toContain("field-memo-error");
    expect(html).toMatch(/id="field-phone"[^>]*class="input w-full max-w-xl input-error"[^>]*aria-invalid="true"/);
    expect(getStore().contacts).toHaveLength(0);
  });

  it("AC-26：電話番号「03-1234-5678」でエラー。入力した値は残す。保存しない", async () => {
    useSeed("AC-26");
    const html = await (await post(NEW, form({ name: "原田", kana: "はらだ", phone: "03-1234-5678" }))).text();
    expect(html).toContain(
      'id="field-phone-error"><p class="error-text mt-1 text-sm">電話番号は半角数字のみで入力してください</p>',
    );
    expect(html).toContain('value="原田"');
    expect(html).toContain('value="はらだ"');
    expect(html).toContain('value="03-1234-5678"');
    expect(getStore().contacts).toHaveLength(0);
  });

  it("AC-60：よみがな「ハラダ」でエラー。保存しない", async () => {
    useSeed("AC-60");
    const html = await (await post(NEW, form({ name: "原田", kana: "ハラダ" }))).text();
    expect(html).toContain(
      'id="field-kana-error"><p class="error-text mt-1 text-sm">担当者名のよみがなはひらがなで入力してください</p>',
    );
    expect(getStore().contacts).toHaveLength(0);
  });

  it("AC-66：電話番号16桁でエラー。保存しない", async () => {
    useSeed("AC-66");
    const html = await (await post(NEW, form({ name: "原田", kana: "はらだ", phone: "0123456789012345" }))).text();
    expect(html).toContain(
      'id="field-phone-error"><p class="error-text mt-1 text-sm">電話番号は15桁以内で入力してください</p>',
    );
    expect(getStore().contacts).toHaveLength(0);
  });

  it("AC-67：電話番号15桁なら保存でき、S-06 の担当者一覧に電話番号つきで表示される", async () => {
    useSeed("AC-67");
    const res = await post(NEW, form({ name: "原田", kana: "はらだ", phone: "012345678901234" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/companies/1");
    expect(contactRows((await page("/companies/1")).html)).toEqual([["原田", "012345678901234"]]);
  });

  it("AC-25：登録すると S-06 会社詳細に戻り「担当者を登録しました」。更新者・更新日時を記録する", async () => {
    useSeed("AC-25");
    const before = Date.now();
    const res = await post(NEW, form({ name: "原田", kana: "はらだ", phone: "0312345678" }), "mock_user=2");
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/companies/1");
    const cookie = res.headers
      .getSetCookie()
      .map((h) => h.split(";")[0])
      .join("; ");
    expect(cookie).toContain("flash=contactCreated");
    const s06 = (await page("/companies/1", cookie)).html;
    expect(s06).toContain('role="status">担当者を登録しました</p>');
    expect(contactRows(s06)).toEqual([["原田", "0312345678"]]);
    const [contact] = getStore().contacts;
    expect(contact).toMatchObject({
      id: 1,
      companyId: 1,
      name: "原田",
      kana: "はらだ",
      phone: "0312345678",
      memo: "",
      deleted: false,
      updatedBy: 2,
    });
    expect(Date.parse(contact?.updatedAt ?? "")).toBeGreaterThanOrEqual(before - 1000);
  });

  it("AC-61：同じ電話番号の担当者も登録でき、担当者一覧に「原田」と「佐藤」が表示される", async () => {
    useSeed("AC-61");
    const res = await post(NEW, form({ name: "佐藤", kana: "さとう", phone: "0312345678" }));
    expect(res.status).toBe(303);
    expect(contactRows((await page("/companies/1")).html)).toEqual([
      ["原田", "0312345678"],
      ["佐藤", "0312345678"],
    ]);
  });

  it("AC-69：担当者名が空でも登録でき、担当者一覧に担当者名の代わりによみがなを表示する", async () => {
    useSeed("AC-69");
    const res = await post(NEW, form({ kana: "はらだ", phone: "0312345678" }));
    expect(res.status).toBe(303);
    expect(contactRows((await page("/companies/1")).html)).toEqual([["はらだ", "0312345678"]]);
    expect(getStore().contacts[0]).toMatchObject({ name: "", kana: "はらだ" });
  });

  it("担当者名・よみがな・電話番号は前後の空白を削って保存する。メモは削らない（Q-M11）", async () => {
    useSeed("AC-25");
    await post(NEW, form({ name: " 原田　", kana: "\tはらだ ", phone: " 0312345678 ", memo: " 総務部\r\n" }));
    expect(getStore().contacts[0]).toMatchObject({
      name: "原田",
      kana: "はらだ",
      phone: "0312345678",
      memo: " 総務部\r\n",
    });
  });

  it("編集は登録済みの値で開き、保存すると所属する会社の S-06 に戻り「担当者を更新しました」", async () => {
    useSeed("AC-61");
    const edit = await page("/contacts/1/edit");
    expect(edit.status).toBe(200);
    expect(edit.html).toContain("<title>担当者登録・編集</title>");
    expect(edit.html).toContain('action="/contacts/1/edit"');
    expect(edit.html).toContain('value="原田"');
    expect(edit.html).toContain('value="はらだ"');
    expect(edit.html).toContain('value="0312345678"');

    const res = await post(
      "/contacts/1/edit",
      form({ name: "原田", kana: "はらだ", phone: "09012345678" }),
      "mock_user=3",
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/companies/1");
    expect(res.headers.getSetCookie().join(";")).toContain("flash=contactUpdated");
    expect(getStore().contacts[0]).toMatchObject({ companyId: 1, phone: "09012345678", updatedBy: 3 });
  });

  it("編集でエラーなら保存しない", async () => {
    useSeed("AC-61");
    const html = await (await post("/contacts/1/edit", form({ name: "原田", kana: "はらだ", phone: "" }))).text();
    expect(html).toContain("電話番号は必須です");
    expect(getStore().contacts[0]).toMatchObject({ phone: "0312345678" });
  });

  it("メモの改行と、改行で始まる値を入力欄に残す", async () => {
    useSeed("AC-61");
    for (const contact of getStore().contacts) contact.memo = "\n1行目\n2行目";
    const { html } = await page("/contacts/1/edit");
    expect(html).toMatch(/<textarea[^>]*>\n\n1行目\n2行目<\/textarea>/);
  });

  it("存在しない・削除された会社への登録、存在しない・削除された担当者の編集は 404", async () => {
    const data = buildDemoData();
    replaceStore(data);
    // デモデータの会社 11 は削除済み
    expect((await page("/companies/999/contacts/new")).status).toBe(404);
    expect((await page("/companies/11/contacts/new")).status).toBe(404);
    expect((await post("/companies/11/contacts/new", form({ kana: "はらだ", phone: "0312345678" }))).status).toBe(404);
    const deleted = data.contacts.find((p) => p.deleted);
    expect(deleted).toBeDefined();
    expect((await page(`/contacts/${deleted?.id}/edit`)).status).toBe(404);
    expect((await post(`/contacts/${deleted?.id}/edit`, form({ kana: "はらだ", phone: "1" }))).status).toBe(404);
    expect((await page("/contacts/9999/edit")).status).toBe(404);
  });
});

describe("S-09 のシード", () => {
  it.each(["AC-26", "AC-59", "AC-60", "AC-66", "AC-67"])(
    "%s は菊地で S-09 担当者登録（マイナビ、担当者0人）を開く",
    async (name) => {
      const res = await app.request(`${BASE}/__seed/${name}`, {}, mockEnv);
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe(NEW);
      expect(res.headers.getSetCookie().join(";")).toContain("mock_user=1");
      expect(getStore().companies.map((c) => c.name)).toEqual(["マイナビ"]);
      expect(getStore().contacts).toHaveLength(0);
    },
  );
});
