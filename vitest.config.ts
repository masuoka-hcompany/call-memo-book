import { readFile } from "node:fs/promises";
import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig, type Plugin } from "vitest/config";

// wrangler.jsonc の rules（*.css を Text で読み込む）に合わせ、テストでも CSS を文字列として読み込む。
// Vitest は .css を空にするため、拡張子が .css で終わらない仮のモジュール ID（app.css.text.js）に置き換える。
const CSS_TEXT_SUFFIX = ".text.js";
const cssAsText: Plugin = {
  name: "css-as-text",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (!source.endsWith(".css") || !importer) return null;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    return resolved ? `${resolved.id}${CSS_TEXT_SUFFIX}` : null;
  },
  async load(id) {
    if (!id.endsWith(`.css${CSS_TEXT_SUFFIX}`)) return null;
    const text = await readFile(id.slice(0, -CSS_TEXT_SUFFIX.length), "utf8");
    return `export default ${JSON.stringify(text)};`;
  },
};

export default defineConfig(async () => {
  // テスト開始時にローカル D1 へ適用するマイグレーション
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

  return {
    plugins: [
      cssAsText,
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // .dev.vars の内容に左右されないよう、テスト用の値をここで固定する
          bindings: {
            ENVIRONMENT: "test",
            ACCESS_TEAM_DOMAIN: "",
            ACCESS_AUD: "",
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
