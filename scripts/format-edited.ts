// Claude Code のフック（.claude/settings.json の PostToolUse）から呼ばれる。
// Claude が編集したファイルに Biome（整形・Lint の自動修正）をかける。
// 直せない指摘が残ったら終了コード 2 で終わり、指摘の内容を Claude に返す（Claude がその場で直す）。
//
// 標準入力には、フックの情報が JSON で渡される（編集したファイルは tool_input.file_path）。
// Biome はコンテナの中にしかないので、コンテナの外で動く Claude Code では何もしない
// （呼び出し側で node_modules/.bin/biome があるときだけ実行している）。

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const TARGET_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".jsonc", ".css"]);

function readFilePath(): string | undefined {
  try {
    const input = JSON.parse(readFileSync(0, "utf8")) as { tool_input?: { file_path?: unknown } };
    const filePath = input.tool_input?.file_path;
    return typeof filePath === "string" ? filePath : undefined;
  } catch {
    return undefined;
  }
}

const projectDir = path.resolve(import.meta.dirname, "..");
const filePath = readFilePath();
if (!filePath) process.exit(0);

// リポジトリの外のファイルと、Biome が扱わない種類のファイルには何もしない
const relative = path.relative(projectDir, path.resolve(projectDir, filePath));
if (relative.startsWith("..") || path.isAbsolute(relative)) process.exit(0);
if (!TARGET_EXTENSIONS.has(path.extname(relative))) process.exit(0);

const result = spawnSync(
  path.join(projectDir, "node_modules/.bin/biome"),
  ["check", "--write", "--no-errors-on-unmatched", relative],
  { cwd: projectDir, encoding: "utf8" },
);

if (result.status !== 0) {
  process.stderr.write(`Biome の指摘が残っています（${relative}）。直してください。\n${result.stdout}${result.stderr}`);
  process.exit(2);
}
