// S-03 取次メモ詳細

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
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

function post(path: string, form: Record<string, string> = {}, cookie?: string) {
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

// 詳細の項目（<dt> と <dd> の組）
function fields(html: string): [string, string][] {
  const dl = html.split("<dl")[1]?.split("</dl>")[0] ?? "";
  return [...dl.matchAll(/<dt[^>]*>([^<]*)<\/dt><dd[^>]*>(.*?)<\/dd>/gs)].map((m) => [
    m[1] as string,
    (m[2] as string).replace(/<[^>]+>/g, ""),
  ]);
}

const memo = () => getStore().memos[0];

describe("S-03 取次メモ詳細", () => {
  it("F-02 の入力項目すべて、作成者、作成日時、状態。更新者・更新日時・対処済みにした人は出さない", async () => {
    useSeed("AC-49");
    const { status, html } = await page("/memos/1");
    expect(status).toBe(200);
    expect(html).toContain("<title>取次メモ詳細");
    expect(fields(html)).toEqual([
      ["宛先", "菊地"],
      ["受電日時", "2026/11/05 10:00"],
      ["会社名", "マイナビ"],
      ["氏名", "原田"],
      ["電話番号", "0312345678"],
      ["用件", "折り返し希望"],
      ["伝言", ""],
      ["メモ", ""],
      ["作成者", "菊地"],
      ["作成日時", "2026/11/05 10:00"],
      ["状態", "● 未対処"],
    ]);
    const dl = html.split("<dl")[1]?.split("</dl>")[0] ?? "";
    expect(dl).not.toContain("更新者");
    expect(dl).not.toContain("更新日時");
    expect(dl).not.toContain("対処済みにした");
  });

  it("AC-49：担当者の電話番号を編集しても、作成時の電話番号「0312345678」を表示する", async () => {
    useSeed("AC-49");
    const { html } = await page("/memos/1");
    expect(fields(html)).toContainEqual(["電話番号", "0312345678"]);
    expect(html).not.toContain("09012345678");
  });

  it("「編集」「削除」「対処済みにする」を全員に表示する（未対処のとき）", async () => {
    useSeed("AC-62");
    const { html } = await page("/memos/1", "mock_user=2");
    expect(html).toContain('<a href="/memos/1/edit" class="btn btn-plain">編集</a>');
    expect(html).toContain(">削除</button>");
    expect(html).toContain("この取次メモを削除しますか？");
    expect(html).toContain('action="/memos/1/done"');
    expect(html).toContain(">対処済みにする</button>");
    expect(html).not.toContain("未対処に戻す");
  });

  it("対処済みのときは「未対処に戻す」", async () => {
    useSeed("AC-19");
    const { html } = await page("/memos/1");
    expect(html).toContain('action="/memos/1/reopen"');
    expect(html).toContain(">未対処に戻す</button>");
    expect(html).not.toContain("対処済みにする");
    expect(fields(html)).toContainEqual(["状態", "✓ 対処済み"]);
  });

  it("伝言・メモの改行をそのまま表示する", async () => {
    useSeed("AC-15");
    Object.assign(memo() as object, { message: "1行目\n2行目" });
    const { html } = await page("/memos/1");
    expect(html).toContain('class="whitespace-pre-wrap break-all">1行目\n2行目</dd>');
  });

  it("削除された宛先の取次メモも、宛先の表示名を出す", async () => {
    useSeed("AC-15");
    Object.assign(getStore().recipients[0] as object, { deleted: true });
    expect(fields((await page("/memos/1")).html)).toContainEqual(["宛先", "菊地"]);
  });

  it("削除された・存在しない取次メモは 404", async () => {
    useSeed("AC-15");
    expect((await page("/memos/9")).status).toBe(404);
    Object.assign(memo() as object, { deleted: true });
    expect((await page("/memos/1")).status).toBe(404);
  });
});

describe("S-03 対処済み・未対処の切り替え", () => {
  it("AC-18・AC-53：対処済みにすると S-03 にとどまり「対処済みにしました」。対処済みにした人・日時を記録する", async () => {
    useSeed("AC-18");
    const before = Date.now();
    const res = await post("/memos/1/done", {}, "mock_user=1");
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/memos/1");
    expect(res.headers.getSetCookie().join(";")).toContain("flash=memoDone");
    expect(memo()).toMatchObject({ status: "done", doneBy: 1 });
    expect(Date.parse(memo()?.doneAt ?? "")).toBeGreaterThanOrEqual(before - 1000);
    // 更新者・更新日時は変えない（仮。Q-M33）
    expect(memo()).toMatchObject({ updatedBy: 1, updatedAt: "2026-11-05T01:00:00.000Z" });
    const { html } = await page("/memos/1", "flash=memoDone");
    expect(html).toContain("対処済みにしました");
    expect(html).toContain(">未対処に戻す</button>");
  });

  it("AC-63：宛先本人以外（益岡）でも対処済みにでき、益岡を記録する", async () => {
    useSeed("AC-63");
    await post("/memos/1/done", {}, "mock_user=2");
    expect(memo()).toMatchObject({ status: "done", doneBy: 2 });
  });

  it("AC-19・AC-54：未対処に戻すと「未対処に戻しました」。対処済みにした人・日時を消す", async () => {
    useSeed("AC-54");
    expect(memo()).toMatchObject({ doneBy: 1, doneAt: "2026-11-05T02:00:00.000Z" });
    const res = await post("/memos/1/reopen", {}, "mock_user=1");
    expect(res.headers.get("Location")).toBe("/memos/1");
    expect(res.headers.getSetCookie().join(";")).toContain("flash=memoReopened");
    expect(memo()).toMatchObject({ status: "open", doneBy: null, doneAt: null });
  });

  it("既に対処済みなら、対処済みにした人・日時を上書きしない（仮。Q-M33）", async () => {
    useSeed("AC-19");
    await post("/memos/1/done", {}, "mock_user=2");
    expect(memo()).toMatchObject({ status: "done", doneBy: 1, doneAt: "2026-11-05T02:00:00.000Z" });
  });

  it("削除された取次メモは切り替えられない（404）", async () => {
    useSeed("AC-18");
    Object.assign(memo() as object, { deleted: true });
    expect((await post("/memos/1/done")).status).toBe(404);
  });
});

describe("S-03 削除", () => {
  it("AC-16：S-02 に戻り「取次メモを削除しました」。一覧に出ず、データは残り削除フラグが立つ", async () => {
    useSeed("AC-16");
    const res = await post("/memos/1/delete", {}, "mock_user=1");
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/memos");
    expect(res.headers.getSetCookie().join(";")).toContain("flash=memoDeleted");
    expect(getStore().memos).toHaveLength(1);
    expect(memo()).toMatchObject({ deleted: true, updatedBy: 1 });
    const { html } = await page("/memos", "flash=memoDeleted");
    expect(html).toContain("取次メモを削除しました");
    expect(html).not.toContain('data-table="memos"');
  });

  it("削除済みをもう一度削除すると 404", async () => {
    useSeed("AC-16");
    await post("/memos/1/delete");
    expect((await post("/memos/1/delete")).status).toBe(404);
  });
});

describe("S-03 のシード", () => {
  it.each([
    ["AC-15", "1"],
    ["AC-16", "1"],
    ["AC-62", "2"],
    ["AC-18", "1"],
    ["AC-19", "1"],
    ["AC-53", "1"],
    ["AC-54", "1"],
    ["AC-63", "2"],
  ])("%s は S-03（/memos/1）を開く", async (name, user) => {
    const res = await app.request(`${BASE}/__seed/${name}`, {}, mockEnv);
    expect(res.headers.get("Location")).toBe("/memos/1");
    expect(res.headers.getSetCookie().join(";")).toContain(`mock_user=${user}`);
    expect(getStore().memos).toHaveLength(1);
  });
});
