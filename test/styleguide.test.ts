import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index.tsx";

const BASE = "http://localhost:8787";
const localEnv = { ...env, ENVIRONMENT: "local" };

describe("/__styleguide", () => {
  it("MOCK_MODE=true のときだけ表示する", async () => {
    const on = await app.request(`${BASE}/__styleguide`, {}, { ...localEnv, MOCK_MODE: "true" });
    expect(on.status).toBe(200);
    const html = await on.text();
    expect(html).toContain('data-theme="rams-a"');
    expect(html).toContain("/styles/app.css");

    const off = await app.request(`${BASE}/__styleguide`, {}, { ...localEnv, MOCK_MODE: "false" });
    expect(off.status).toBe(404);
  });

  it("Access の設定値がないデプロイ環境では、MOCK_MODE=true でも拒否する", async () => {
    const res = await app.request(
      "https://call-memo-book.example.workers.dev/__styleguide",
      {},
      { ...env, ENVIRONMENT: "production", MOCK_MODE: "true" },
    );
    expect(res.status).not.toBe(200);
  });
});

describe("/styles/app.css", () => {
  it("テーマ rams-a を含む CSS を返す", async () => {
    const res = await app.request(`${BASE}/styles/app.css`, {}, localEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/css");
    expect(await res.text()).toContain('[data-theme="rams-a"]');
  });
});
