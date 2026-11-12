// S-04 取次メモ作成・編集

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { toJstDateTimeLocal } from "../src/domain/datetime.ts";
import app from "../src/index.tsx";
import { findSeed } from "../src/mock/seeds.ts";
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

// 入力欄の値
function value(html: string, name: string): string {
  const input = new RegExp(String.raw`<input[^>]*name="${name}"[^>]*value="([^"]*)"`).exec(html);
  if (input) return input[1] as string;
  const select = html.split(`name="${name}"`)[1]?.split("</select>")[0] ?? "";
  return /<option value="([^"]*)" selected="">/.exec(select)?.[1] ?? "";
}

function options(html: string, name: string): string[] {
  const select = html.split(`name="${name}"`)[1]?.split("</select>")[0] ?? "";
  return [...select.matchAll(/<option value="[^"]*"[^>]*>([^<]*)<\/option>/g)].map((m) => m[1] as string);
}

function errorOf(html: string, name: string): string[] {
  const block = html.split(`id="field-${name}-error">`)[1]?.split("</div>")[0] ?? "";
  return [...block.matchAll(/<p class="error-text mt-1 text-sm">([^<]*)<\/p>/g)].map((m) => m[1] as string);
}

// AC-08 などの共通の入力：宛先「菊地」、会社名「マイナビ」、用件「伝言希望」
const form = (v: Record<string, string> = {}) => ({
  recipientId: "1",
  receivedAt: "2026-11-05T14:30",
  companyName: "マイナビ",
  personName: "",
  phone: "",
  purpose: "message",
  message: "",
  note: "",
  ...v,
});

describe("S-04 取次メモ作成", () => {
  it("項目名・プルダウン・「保存」。宛先・用件は未選択、受電日時は開いた日時（日本時間・分単位）で開く", async () => {
    useSeed("AC-07");
    const before = toJstDateTimeLocal(new Date());
    const { status, html } = await page("/memos/new");
    const after = toJstDateTimeLocal(new Date());
    expect(status).toBe(200);
    expect(html).toContain("<title>取次メモ作成・編集</title>");
    expect(html).toMatch(/href="\/memos" class="nav-item[^"]*" aria-current="page"/);
    const labels = [...html.matchAll(/<label for="field-[^"]+" class="mb-1 block text-sm">([^<]*)<\/label>/g)].map(
      (m) => m[1],
    );
    expect(labels).toEqual(["宛先", "受電日時", "会社名", "氏名", "電話番号", "用件", "伝言", "メモ"]);
    expect(options(html, "recipientId")).toEqual(["", "菊地", "社長"]);
    expect(options(html, "purpose")).toEqual(["", "折り返し希望", "連絡があったことをお伝え希望", "伝言希望"]);
    expect(value(html, "recipientId")).toBe("");
    expect(value(html, "purpose")).toBe("");
    expect(html).toMatch(/<input type="datetime-local" id="field-receivedAt" name="receivedAt"/);
    expect([before, after]).toContain(value(html, "receivedAt"));
    for (const name of ["companyName", "personName", "phone"]) expect(value(html, name)).toBe("");
    expect(html).not.toContain('name="companyId"');
    expect(html).toMatch(/<button type="submit" class="btn btn-primary">保存<\/button>/);
    expect(html).toContain("novalidate");
    expect(html).not.toMatch(/required|maxlength|pattern=/);
    for (const id of ["Q-M15", "Q-M16", "Q-M28", "Q-M29"]) expect(html).toContain(`【未決】${id}`);
  });

  it("AC-05：S-01 で選んだ担当者の会社名・氏名・電話番号が入る", async () => {
    useSeed("AC-05");
    const s01 = (await page(`/?q=${encodeURIComponent("原田")}&contact=1`)).html;
    expect(s01).toContain('href="/memos/new?contact=1"');
    const { html } = await page("/memos/new?contact=1");
    expect(value(html, "companyName")).toBe("マイナビ");
    expect(value(html, "personName")).toBe("原田");
    expect(value(html, "phone")).toBe("0312345678");
    expect(html).toContain('<input type="hidden" name="companyId" value="1"/>');
    expect(html).toContain('<input type="hidden" name="contactId" value="1"/>');
  });

  it("AC-05：保存すると S-02 に移り「取次メモを登録しました」。会社・担当者を紐づけ、作成者・状態を記録する", async () => {
    useSeed("AC-05");
    const before = Date.now();
    const res = await post(
      "/memos/new",
      form({ personName: "原田", phone: "0312345678", purpose: "callback", companyId: "1", contactId: "1" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/memos");
    expect(res.headers.getSetCookie().join(";")).toContain("flash=memoCreated");
    const [memo] = getStore().memos;
    expect(memo).toMatchObject({
      id: 1,
      recipientId: 1,
      receivedAt: "2026-11-05T05:30:00.000Z",
      companyName: "マイナビ",
      personName: "原田",
      phone: "0312345678",
      companyId: 1,
      contactId: 1,
      purpose: "callback",
      status: "open",
      doneBy: null,
      doneAt: null,
      createdBy: 1,
      updatedBy: 1,
      deleted: false,
    });
    expect(Date.parse(memo?.createdAt ?? "")).toBeGreaterThanOrEqual(before - 1000);
  });

  it("会社だけの行を選んだときは会社名だけが入り、会社だけを紐づける。名前が空の会社・担当者はよみがなを入れる", async () => {
    useSeed("AC-05");
    const [company] = getStore().companies;
    const [contact] = getStore().contacts;
    if (!company || !contact) throw new Error("seed");
    company.name = "";
    contact.name = "";
    const byContact = (await page("/memos/new?contact=1")).html;
    expect(value(byContact, "companyName")).toBe("まいなび");
    expect(value(byContact, "personName")).toBe("はらだ");
    const byCompany = (await page("/memos/new?company=1")).html;
    expect(value(byCompany, "companyName")).toBe("まいなび");
    expect(value(byCompany, "personName")).toBe("");
    expect(byCompany).not.toContain('name="contactId"');
  });

  it("自動で入った値は修正でき、修正した値で保存する（紐づけは残す）", async () => {
    useSeed("AC-05");
    await post(
      "/memos/new",
      form({ companyName: "マイナビ（本社）", personName: "原田様", companyId: "1", contactId: "1" }),
    );
    expect(getStore().memos[0]).toMatchObject({ companyName: "マイナビ（本社）", personName: "原田様", contactId: 1 });
  });

  it("削除された・存在しない会社・担当者は紐づけない", async () => {
    useSeed("AC-05");
    for (const p of getStore().contacts) p.deleted = true;
    expect(value((await page("/memos/new?contact=1")).html, "companyName")).toBe("");
    await post("/memos/new", form({ companyId: "1", contactId: "1" }));
    await post("/memos/new", form({ companyId: "99" }));
    expect(getStore().memos.map((m) => [m.companyId, m.contactId])).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it("AC-06：未登録の相手は、会社・担当者として登録しない", async () => {
    useSeed("AC-06");
    const s01 = (await page(`/?q=${encodeURIComponent("ミイダス")}`)).html;
    expect(s01).toContain('href="/memos/new"');
    const res = await post("/memos/new", form({ companyName: "ミイダス", message: "資料を送付しました" }));
    expect(res.status).toBe(303);
    expect(getStore().memos[0]).toMatchObject({ companyName: "ミイダス", companyId: null, contactId: null });
    expect(getStore().companies).toHaveLength(0);
  });

  it("AC-07：何も入力しないと、宛先・受電日時・会社名・用件の欄にそれぞれ必須のエラー。保存しない", async () => {
    useSeed("AC-07");
    const res = await post("/memos/new", {
      recipientId: "",
      receivedAt: "",
      companyName: "",
      personName: "",
      phone: "",
      purpose: "",
      message: "",
      note: "",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(errorOf(html, "recipientId")).toEqual(["宛先は必須です"]);
    expect(errorOf(html, "receivedAt")).toEqual(["受電日時は必須です"]);
    expect(errorOf(html, "companyName")).toEqual(["会社名は必須です"]);
    expect(errorOf(html, "purpose")).toEqual(["用件は必須です"]);
    for (const name of ["personName", "phone", "message", "note"]) expect(html).not.toContain(`field-${name}-error`);
    expect(html).toMatch(
      /id="field-recipientId"[^>]*class="select w-full max-w-xl select-error"[^>]*aria-invalid="true"/,
    );
    // 受電日時は空のまま残す
    expect(value(html, "receivedAt")).toBe("");
    expect(getStore().memos).toHaveLength(0);
  });

  it("AC-08：電話番号「03-1234-5678」でエラー。入力した値を残す。保存しない", async () => {
    useSeed("AC-08");
    const html = await (await post("/memos/new", form({ phone: "03-1234-5678", note: "メモ" }))).text();
    expect(errorOf(html, "phone")).toEqual(["電話番号は半角数字のみで入力してください"]);
    expect(value(html, "recipientId")).toBe("1");
    expect(value(html, "purpose")).toBe("message");
    expect(value(html, "phone")).toBe("03-1234-5678");
    expect(html).toMatch(/<textarea[^>]*name="note"[^>]*>\nメモ<\/textarea>/);
    expect(getStore().memos).toHaveLength(0);
  });

  it("AC-09：用件「折り返し希望」で電話番号が空ならエラー。保存しない", async () => {
    useSeed("AC-09");
    const html = await (await post("/memos/new", form({ purpose: "callback" }))).text();
    expect(errorOf(html, "phone")).toEqual(["折り返し希望の場合、電話番号は必須です"]);
    expect(getStore().memos).toHaveLength(0);
  });

  it("AC-10：会社名256文字でエラー。保存しない", async () => {
    useSeed("AC-10");
    const html = await (await post("/memos/new", form({ companyName: "あ".repeat(256) }))).text();
    expect(errorOf(html, "companyName")).toEqual(["会社名は255文字以内で入力してください"]);
    expect(getStore().memos).toHaveLength(0);
  });

  it("AC-33：会社名255文字なら保存できる", async () => {
    useSeed("AC-33");
    const res = await post("/memos/new", form({ companyName: "あ".repeat(255) }));
    expect(res.headers.get("Location")).toBe("/memos");
    expect(getStore().memos[0]?.companyName).toBe("あ".repeat(255));
  });

  it("AC-36：伝言1,001文字でエラー。保存しない", async () => {
    useSeed("AC-36");
    const html = await (await post("/memos/new", form({ message: "あ".repeat(1001) }))).text();
    expect(errorOf(html, "message")).toEqual(["伝言は1,000文字以内で入力してください"]);
    expect(getStore().memos).toHaveLength(0);
  });

  it("AC-37：伝言1,000文字なら保存でき、すべて保存する", async () => {
    useSeed("AC-37");
    await post("/memos/new", form({ message: "あ".repeat(1000) }));
    expect(getStore().memos[0]?.message).toBe("あ".repeat(1000));
  });

  it("AC-51：削除された宛先はプルダウンに出さない。送られても保存しない", async () => {
    useSeed("AC-51");
    expect(options((await page("/memos/new")).html, "recipientId")).toEqual(["", "菊地", "社長"]);
    const html = await (await post("/memos/new", form({ recipientId: "3" }))).text();
    expect(errorOf(html, "recipientId")).toEqual(["宛先は必須です"]);
    expect(getStore().memos).toHaveLength(0);
  });

  it("AC-64：電話番号16桁でエラー。保存しない", async () => {
    useSeed("AC-64");
    const html = await (await post("/memos/new", form({ phone: "0123456789012345" }))).text();
    expect(errorOf(html, "phone")).toEqual(["電話番号は15桁以内で入力してください"]);
    expect(getStore().memos).toHaveLength(0);
  });

  it("AC-65：電話番号15桁なら保存できる", async () => {
    useSeed("AC-65");
    const res = await post("/memos/new", form({ phone: "012345678901234" }));
    expect(res.headers.get("Location")).toBe("/memos");
    expect(getStore().memos[0]).toMatchObject({ companyName: "マイナビ", phone: "012345678901234" });
  });

  it("受電日時は変更でき、日本時間として保存する", async () => {
    useSeed("AC-65");
    await post("/memos/new", form({ receivedAt: "2026-11-01T00:05" }));
    expect(getStore().memos[0]?.receivedAt).toBe("2026-10-31T15:05:00.000Z");
  });
});

describe("S-04 取次メモ編集", () => {
  async function created() {
    useSeed("AC-05");
    await post(
      "/memos/new",
      form({ personName: "原田", phone: "0312345678", message: "伝言", companyId: "1", contactId: "1" }),
      "mock_user=1",
    );
    return getStore().memos[0];
  }

  it("登録済みの値で開く（受電日時は日本時間）", async () => {
    await created();
    const { status, html } = await page("/memos/1/edit");
    expect(status).toBe(200);
    expect(html).toContain("<title>取次メモ作成・編集</title>");
    expect(html).toContain('action="/memos/1/edit"');
    expect(value(html, "recipientId")).toBe("1");
    expect(value(html, "receivedAt")).toBe("2026-11-05T14:30");
    expect(value(html, "companyName")).toBe("マイナビ");
    expect(value(html, "purpose")).toBe("message");
    expect(html).toMatch(/<textarea[^>]*name="message"[^>]*>\n伝言<\/textarea>/);
    expect(html).not.toContain('name="contactId"');
  });

  it("AC-15・AC-62：用件を変えて保存すると S-03 に戻り「取次メモを更新しました」。作成者・紐づけは変えず、更新者を記録する", async () => {
    const before = await created();
    const res = await post(
      "/memos/1/edit",
      form({ personName: "原田", phone: "0312345678", purpose: "notify" }),
      "mock_user=2",
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/memos/1");
    expect(res.headers.getSetCookie().join(";")).toContain("flash=memoUpdated");
    expect(getStore().memos[0]).toMatchObject({
      purpose: "notify",
      createdBy: 1,
      createdAt: before?.createdAt,
      companyId: 1,
      contactId: 1,
      status: "open",
      updatedBy: 2,
    });
  });

  it("エラーなら保存しない", async () => {
    await created();
    const html = await (await post("/memos/1/edit", form({ companyName: "" }))).text();
    expect(errorOf(html, "companyName")).toEqual(["会社名は必須です"]);
    expect(getStore().memos[0]?.companyName).toBe("マイナビ");
  });

  it("存在しない・削除された取次メモの編集は 404", async () => {
    await created();
    expect((await page("/memos/9/edit")).status).toBe(404);
    for (const m of getStore().memos) m.deleted = true;
    expect((await page("/memos/1/edit")).status).toBe(404);
    expect((await post("/memos/1/edit", form())).status).toBe(404);
  });
});

describe("S-04 のシード", () => {
  it.each(["AC-07", "AC-08", "AC-09", "AC-10", "AC-33", "AC-36", "AC-37", "AC-51", "AC-64", "AC-65"])(
    "%s は菊地で S-04 取次メモ作成を開く（取次メモ0件）",
    async (name) => {
      const res = await app.request(`${BASE}/__seed/${name}`, {}, mockEnv);
      expect(res.headers.get("Location")).toBe("/memos/new");
      expect(res.headers.getSetCookie().join(";")).toContain("mock_user=1");
      expect(getStore().memos).toHaveLength(0);
    },
  );

  it("AC-05 は「マイナビ／原田」を選んだ S-01、AC-06 は「ミイダス」で0件の S-01 を開く", async () => {
    const r5 = await app.request(`${BASE}/__seed/AC-05`, {}, mockEnv);
    expect(r5.headers.get("Location")).toBe(`/?q=${encodeURIComponent("原田")}&contact=1`);
    const r6 = await app.request(`${BASE}/__seed/AC-06`, {}, mockEnv);
    expect(r6.headers.get("Location")).toBe(`/?q=${encodeURIComponent("ミイダス")}`);
    expect(getStore().companies).toHaveLength(0);
  });
});
