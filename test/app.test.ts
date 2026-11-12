import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index.tsx";
import { buildDemoData } from "../src/mock/seeds.ts";
import { replaceStore } from "../src/mock/store.ts";
import { SCREENS } from "../src/views/screens.ts";

const BASE = "http://localhost:8787";
const mockEnv = { ...env, ENVIRONMENT: "local", MOCK_MODE: "true" };
const noMockEnv = { ...env, ENVIRONMENT: "local", MOCK_MODE: "false" };

function get(path: string, cookie?: string, e = mockEnv) {
  return app.request(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {} }, e);
}

function post(path: string, form: Record<string, string>, origin = BASE) {
  return app.request(
    `${BASE}${path}`,
    { method: "POST", body: new URLSearchParams(form), headers: { Origin: origin } },
    mockEnv,
  );
}

// Set-Cookie から「名前=値」だけを取り出す
function cookieOf(res: Response, name: string): string {
  const header = res.headers.getSetCookie().find((h) => h.startsWith(`${name}=`));
  return header ? (header.split(";")[0] as string) : "";
}

async function storeJson() {
  const res = await get("/__debug/store");
  return (await res.json()) as { companies: unknown[]; contacts: unknown[]; memos: unknown[]; users: unknown[] };
}

beforeEach(() => {
  replaceStore(buildDemoData());
});

describe("Access の認証", () => {
  it("Access 設定値が未設定のデプロイ環境では、Worker 全体がリクエストを拒否する", async () => {
    // vitest.config.ts で ENVIRONMENT=test・Access 設定値は空にしている
    const res = await exports.default.fetch("https://app.example.workers.dev/");
    expect(res.status).toBe(500);
  });

  it("MOCK_MODE=true でも、Access の設定値がないデプロイ環境ではシードを拒否する", async () => {
    const res = await exports.default.fetch("https://app.example.workers.dev/__seed/default");
    expect(res.status).toBe(500);
  });
});

describe("レイアウト", () => {
  it("メニューと、ログイン中の利用者名（指定がなければ菊地）を表示する", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const label of ["相手検索", "取次メモ一覧", "会社一覧", "宛先一覧"]) {
      expect(html).toContain(label);
    }
    expect(html).toMatch(/data-testid="current-user">菊地</);
    expect(html).toContain("モック用：ログインユーザー切替");
  });

  it("現在地のメニューに aria-current を付ける", async () => {
    const html = await (await get("/companies")).text();
    expect(html).toMatch(/href="\/companies" class="nav-item[^"]*" aria-current="page"/);
  });

  it("すべての画面を作ったので、仮のページは出さない", async () => {
    expect(SCREENS.filter((s) => !s.built).map((s) => s.id)).toEqual([]);
    const res = await get("/memos/1");
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("モック用：この画面はまだ作っていません");
  });

  it("MOCK_MODE でなければログインユーザー切替を出さず、Access のユーザーで利用者を探す", async () => {
    const res = await get("/", undefined, { ...noMockEnv, DEV_USER_EMAIL: "masuoka@example.com" });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/data-testid="current-user">益岡</);
    expect(html).not.toContain("モック用：ログインユーザー切替");
  });

  it("MOCK_MODE でなく、Access のユーザーが利用者にいなければ拒否する（F-10 はモックで作らない）", async () => {
    const res = await get("/", undefined, { ...noMockEnv, DEV_USER_EMAIL: "someone@example.com" });
    expect(res.status).toBe(403);
  });
});

describe("ログインユーザー切替", () => {
  it("切り替えると表示名が変わり、元の画面に戻る", async () => {
    const res = await post("/__mock/login-user", { user: "2", back: "/companies?q=a" });
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/companies?q=a");
    const cookie = cookieOf(res, "mock_user");
    expect(cookie).toBe("mock_user=2");

    const html = await (await get("/", cookie)).text();
    expect(html).toMatch(/data-testid="current-user">益岡</);
  });

  it("別のサイトには戻らない", async () => {
    const res = await post("/__mock/login-user", { user: "3", back: "//evil.example/" });
    expect(res.headers.get("Location")).toBe("/");
  });

  it("存在しない利用者を指定したら菊地として扱う", async () => {
    const html = await (await get("/", "mock_user=999")).text();
    expect(html).toMatch(/data-testid="current-user">菊地</);
  });

  it("別オリジンからの POST は拒否する（CSRF 対策）", async () => {
    const res = await post("/__mock/login-user", { user: "2", back: "/" }, "https://evil.example");
    expect(res.status).toBe(403);
  });
});

describe("完了メッセージ", () => {
  it("Cookie の完了メッセージを1回だけ表示する", async () => {
    const res = await get("/companies", "flash=companyDeleted");
    const html = await res.text();
    expect(html).toContain('role="status"');
    expect(html).toContain("会社を削除しました");
    expect(cookieOf(res, "flash")).toBe("flash=");
  });

  it("知らないキーは表示しない", async () => {
    const html = await (await get("/companies", "flash=%3Cscript%3E")).text();
    expect(html).not.toContain('role="status"');
  });
});

describe("シードとデバッグ", () => {
  it("/__seed にシードへのリンクを表示する", async () => {
    const html = await (await get("/__seed")).text();
    expect(html).toContain('href="/__seed/default"');
    expect(html).toContain('href="/__seed/demo"');
  });

  it("/__seed/default で共通の前提の状態になり、菊地に切り替わる", async () => {
    const res = await get("/__seed/default", "mock_user=2");
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/");
    expect(cookieOf(res, "mock_user")).toBe("mock_user=1");

    const data = await storeJson();
    expect(data.users).toHaveLength(3);
    expect(data.companies).toHaveLength(0);
    expect(data.contacts).toHaveLength(0);
    expect(data.memos).toHaveLength(0);
  });

  it("/__seed/demo でデモデータに戻る", async () => {
    await get("/__seed/default");
    await get("/__seed/demo");
    const data = await storeJson();
    expect(data.companies.length).toBeGreaterThanOrEqual(10);
    expect(data.memos.length).toBeGreaterThan(50);
  });

  it("知らないシードは 404", async () => {
    expect((await get("/__seed/AC-99")).status).toBe(404);
  });

  it("/__debug/store は削除済みも含めて返す", async () => {
    const data = (await storeJson()) as { companies: { deleted: boolean }[] };
    expect(data.companies.some((c) => c.deleted)).toBe(true);
  });

  it.each(["/__seed", "/__seed/default", "/__debug/store"])("MOCK_MODE でなければ %s は 404", async (path) => {
    expect((await get(path, undefined, noMockEnv)).status).toBe(404);
  });

  it("MOCK_MODE でなければ切替の POST も 404", async () => {
    const res = await app.request(
      `${BASE}/__mock/login-user`,
      { method: "POST", body: new URLSearchParams({ user: "2" }), headers: { Origin: BASE } },
      noMockEnv,
    );
    expect(res.status).toBe(404);
  });
});
