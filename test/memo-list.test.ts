// S-02 取次メモ一覧

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index.tsx";
import { findSeed } from "../src/mock/seeds.ts";
import { getStore, replaceStore } from "../src/mock/store.ts";
import { pageHref } from "../src/views/MemoListPage.tsx";

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

// 一覧の行の、ある列の値（上から順に）
function column(html: string, field: string): string[] {
  const body = html.split('data-table="memos"')[1]?.split("</table>")[0] ?? "";
  return [...body.matchAll(new RegExp(`data-field="${field}">(.*?)</td>`, "gs"))].map((m) =>
    (m[1] as string).replace(/<[^>]+>/g, "").trim(),
  );
}

function options(html: string, name: string): string[] {
  const select = html.split(`name="${name}"`)[1]?.split("</select>")[0] ?? "";
  return [...select.matchAll(/<option value="[^"]*"[^>]*>([^<]*)<\/option>/g)].map((m) => m[1] as string);
}

describe("S-02 取次メモ一覧", () => {
  it("絞り込み（宛先・状態・受電日時の期間）、キーワード、「取次メモを作成」。一覧の列は仕様書 7.1 のとおり", async () => {
    useSeed("AC-11");
    const { status, html } = await page("/memos");
    expect(status).toBe(200);
    expect(html).toContain("<title>取次メモ一覧");
    expect(options(html, "recipient")).toEqual(["すべて", "自分宛て", "菊地", "社長"]);
    expect(options(html, "status")).toEqual(["すべて", "未対処", "対処済み"]);
    expect(html).toContain("受電日時の期間");
    expect(html).toContain('<input type="date" name="from"');
    expect(html).toContain('<input type="date" name="to"');
    expect(html).toContain("キーワード");
    expect(html).toContain('<a href="/memos/new" class="btn btn-primary">取次メモを作成</a>');
    const head = html.split('data-table="memos"')[1]?.split("</thead>")[0] ?? "";
    expect([...head.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1])).toEqual([
      "受電日時",
      "宛先",
      "会社名",
      "氏名",
      "用件",
      "状態",
      "作成者",
    ]);
  });

  it("開いたときは全員宛て・全状態。受電日時の新しい順で、日本時間「2026/11/05 10:00」形式", async () => {
    useSeed("AC-11");
    const { html } = await page("/memos");
    expect(column(html, "companyName")).toEqual(["会社①", "会社②", "会社③"]);
    expect(column(html, "receivedAt")).toEqual(["2026/11/05 10:00", "2026/11/05 09:59", "2026/11/05 09:58"]);
    expect(column(html, "recipient")).toEqual(["菊地", "菊地", "社長"]);
    expect(column(html, "purpose")).toEqual(["伝言希望", "伝言希望", "伝言希望"]);
    expect(column(html, "status")).toEqual(["● 未対処", "✓ 対処済み", "● 未対処"]);
    expect(column(html, "createdBy")).toEqual(["菊地", "菊地", "菊地"]);
  });

  it("行から S-03 取次メモ詳細を開く", async () => {
    useSeed("AC-14");
    const { html } = await page("/memos");
    expect(html).toContain('onclick="location.href=&#39;/memos/1&#39;"');
    expect(html).toContain('<a href="/memos/1" class="link">2026/11/05 10:00</a>');
  });

  it("AC-11：宛先「自分宛て」・状態「未対処」で ① だけ", async () => {
    useSeed("AC-11");
    const { html } = await page("/memos?recipient=me&status=open");
    expect(column(html, "companyName")).toEqual(["会社①"]);
    // 絞り込み条件を残す
    expect(html).toContain('<option value="me" selected="">自分宛て</option>');
    expect(html).toContain('<option value="open" selected="">未対処</option>');
  });

  it("「自分宛て」は、切り替えた利用者と同じメールアドレスの宛先（宛先でない益岡は0件）", async () => {
    useSeed("AC-11");
    const { html } = await page("/memos?recipient=me", "mock_user=2");
    expect(html).toContain("条件に一致する取次メモはありません");
  });

  it("AC-12：キーワード「見積」で ① だけ", async () => {
    useSeed("AC-12");
    const { html } = await page(`/memos?q=${encodeURIComponent("見積")}`);
    expect(column(html, "companyName")).toEqual(["会社①"]);
    expect(html).toContain('value="見積"');
  });

  it("AC-13：取次メモが1件もなければ「取次メモはまだありません」", async () => {
    useSeed("AC-13");
    const { html } = await page("/memos");
    expect(html).toContain("取次メモはまだありません");
    expect(html).not.toContain('data-table="memos"');
    // 絞り込んでも同じ
    expect((await page(`/memos?q=${encodeURIComponent("見積")}`)).html).toContain("取次メモはまだありません");
  });

  it("AC-14：条件に一致しなければ「条件に一致する取次メモはありません」", async () => {
    useSeed("AC-14");
    const { html } = await page(`/memos?q=${encodeURIComponent("請求")}`);
    expect(html).toContain("条件に一致する取次メモはありません");
    expect(html).not.toContain("取次メモはまだありません");
    expect(html).not.toContain('data-table="memos"');
  });

  it("AC-38：51件なら1ページ目に会社01〜会社50、次のページへの切り替え。2ページ目に会社51", async () => {
    useSeed("AC-38");
    const first = (await page("/memos")).html;
    const names = column(first, "companyName");
    expect(names).toHaveLength(50);
    expect(names[0]).toBe("会社01");
    expect(names[49]).toBe("会社50");
    expect(first).not.toContain("会社51");
    expect(first).toContain('<a href="/memos?page=2" class="btn btn-plain" rel="next">次へ</a>');
    expect(first).toContain("1 / 2");
    const second = (await page("/memos?page=2")).html;
    expect(column(second, "companyName")).toEqual(["会社51"]);
    expect(second).toContain('<a href="/memos" class="btn btn-plain" rel="prev">前へ</a>');
  });

  it("50件以下ならページ切り替えを出さない", async () => {
    useSeed("AC-11");
    expect((await page("/memos")).html).not.toContain('data-section="pager"');
  });

  it("AC-52：期間 2026-11-02〜2026-11-04 で ② だけ", async () => {
    useSeed("AC-52");
    const { html } = await page("/memos?from=2026-11-02&to=2026-11-04");
    expect(column(html, "receivedAt")).toEqual(["2026/11/03 10:00"]);
    expect(html).toContain('name="from" value="2026-11-02"');
  });

  it("削除された取次メモは出さない。削除された宛先の取次メモは、宛先名を出す", async () => {
    useSeed("AC-11");
    const store = getStore();
    (store.memos[0] as { deleted: boolean }).deleted = true;
    store.recipients.push({
      id: 3,
      displayName: "木村",
      email: "kimura@example.com",
      deleted: true,
      updatedBy: 1,
      updatedAt: "2026-11-02T01:00:00.000Z",
    });
    (store.memos[2] as { recipientId: number }).recipientId = 3;
    const { html } = await page("/memos");
    expect(column(html, "companyName")).toEqual(["会社②", "会社③"]);
    expect(column(html, "recipient")).toEqual(["菊地", "木村"]);
    // 絞り込みの選択肢には、削除された宛先を出さない
    expect(options(html, "recipient")).toEqual(["すべて", "自分宛て", "菊地", "社長"]);
  });

  it("作成の保存のあとは「取次メモを登録しました」", async () => {
    useSeed("AC-13");
    const { html } = await page("/memos", "flash=memoCreated");
    expect(html).toContain("取次メモを登録しました");
  });
});

describe("pageHref（絞り込み条件を残してページを変える）", () => {
  it("空の条件は付けない。1ページ目は page を付けない", () => {
    const q = { recipient: "me", status: "", from: "2026-11-02", to: "", q: "見積 書", page: "3" };
    expect(pageHref(q, 2)).toBe("/memos?recipient=me&from=2026-11-02&q=%E8%A6%8B%E7%A9%8D+%E6%9B%B8&page=2");
    expect(pageHref(q, 1)).toBe("/memos?recipient=me&from=2026-11-02&q=%E8%A6%8B%E7%A9%8D+%E6%9B%B8");
  });
});

describe("S-02 のシード", () => {
  it.each(["AC-11", "AC-12", "AC-13", "AC-14", "AC-38", "AC-52", "AC-49"])(
    "%s は菊地で S-02 取次メモ一覧を開く",
    async (name) => {
      const res = await app.request(`${BASE}/__seed/${name}`, {}, mockEnv);
      expect(res.headers.get("Location")).toBe("/memos");
      expect(res.headers.getSetCookie().join(";")).toContain("mock_user=1");
    },
  );

  it("AC-49：取次メモは作成時の電話番号、担当者は編集後の電話番号", () => {
    useSeed("AC-49");
    const store = getStore();
    expect(store.memos[0]).toMatchObject({ phone: "0312345678", contactId: 1, companyId: 1 });
    expect(store.contacts[0]).toMatchObject({ id: 1, phone: "09012345678" });
  });
});
