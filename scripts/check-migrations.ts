// npm run migrations:check
// migrations/ が決まり（docs/migrations.md）に合っているかを確かめる。CI と npm run check で実行する。
//
// - ファイル名と番号（重なりがないこと）
// - リモートに当てたマイグレーション（migrations/APPLIED の番号まで）を、書き換えていない・消していないこと
// - まだ当てていないマイグレーションに、D1 で使えない文がないこと
//
// 書き換えは、main（既定は origin/main。環境変数 MIGRATIONS_BASE で変えられる）と比べて確かめる。
// 決まりの中身は scripts/migrations-rules.ts。

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { checkMigrations, type MigrationFile } from "./migrations-rules.ts";

const MIGRATIONS_DIR = "migrations";
const APPLIED_FILE = `${MIGRATIONS_DIR}/APPLIED`;
const baseRef = process.env.MIGRATIONS_BASE || "origin/main";

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function readCurrent(): MigrationFile[] {
  const names = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.toLowerCase().endsWith(".sql"))
    .sort();
  if (names.length === 0) return [];
  const paths = names.map((name) => path.posix.join(MIGRATIONS_DIR, name));
  // git と同じ方法でハッシュを計算する（改行コードの変換も git の設定どおりになる）
  const hashes = git(["hash-object", "--", ...paths])?.split("\n");
  if (!hashes || hashes.length !== names.length) {
    console.error("git hash-object に失敗しました。git が使える場所で実行してください。");
    process.exit(1);
  }
  return names.map((name, i) => ({
    name,
    hash: hashes[i] ?? "",
    sql: readFileSync(path.join(MIGRATIONS_DIR, name), "utf8"),
  }));
}

function readBase(): { files: MigrationFile[]; applied: string | null } | null {
  // 比べる元と今のブランチが分かれた点（main が先に進んでいても、このブランチの変更だけを見る）
  const mergeBase = git(["merge-base", baseRef, "HEAD"]);
  if (!mergeBase) return null;
  const tree = git(["ls-tree", mergeBase, `${MIGRATIONS_DIR}/`]) ?? "";
  const files: MigrationFile[] = [];
  for (const line of tree.split("\n")) {
    // 例：100644 blob <ハッシュ>\tmigrations/0001_create_items.sql
    const match = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(line);
    const name = match?.[2] ? path.posix.basename(match[2]) : undefined;
    if (match?.[1] && name?.toLowerCase().endsWith(".sql")) files.push({ name, hash: match[1] });
  }
  return { files, applied: git(["show", `${mergeBase}:${APPLIED_FILE}`]) };
}

const current = readCurrent();
const applied = existsSync(APPLIED_FILE) ? readFileSync(APPLIED_FILE, "utf8").trim() : null;
const base = readBase();

if (!base) {
  const message = `${baseRef} が見つからないので、main と比べる検査（書き換え・削除）ができません。`;
  // CI では必ず比べる（actions/checkout の fetch-depth: 0 が必要）
  if (process.env.CI) {
    console.error(`${message} CI では履歴を取得してください。`);
    process.exit(1);
  }
  console.warn(`${message} 今のファイルだけで分かることを確かめます（git fetch origin をすると比べられます）。`);
}

const errors = checkMigrations({ current, applied, base });
if (errors.length > 0) {
  console.error("マイグレーションが決まり（docs/migrations.md）に合っていません。");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`Migrations OK（${current.length} 件、リモートに当てたのは ${applied} まで）`);
