// npm run setup
// 氏名とアプリ名から <氏名>-<アプリ名>（Worker）と <氏名>-<アプリ名>-db（D1）を決め、
// D1 を作成して wrangler.jsonc に書き込む。ローカル D1 にマイグレーションも適用する。
//
// 対話入力:       npm run setup
// 引数で指定:     npm run setup -- --name masuoka --app todo
// 何度実行しても壊れない（作成済みの D1 はそのまま使う）。

import {
  DB_BINDING,
  fail,
  getArg,
  getD1Index,
  isConfigured,
  listD1Databases,
  NAME_PATTERN,
  prompt,
  readWranglerConfig,
  requireCloudflareEnv,
  updateWranglerConfig,
  WRANGLER_CONFIG,
  wrangler,
} from "./lib.ts";

async function askName(label: string, argName: string, example: string): Promise<string> {
  const value = getArg(argName) ?? (await prompt(`${label}（例: ${example}）: `));
  if (!NAME_PATTERN.test(value)) {
    fail(
      `${label}「${value}」は使えません。小文字英数字とハイフンのみ（先頭・末尾・連続ハイフン不可）で入力してください。`,
    );
  }
  return value;
}

requireCloudflareEnv();

const person = await askName("氏名（ローマ字）", "name", "masuoka");
const app = await askName("アプリ名", "app", "todo");
const workerName = `${person}-${app}`;
const databaseName = `${workerName}-db`;

console.log(`\nWorker: ${workerName}\nD1    : ${databaseName}`);

// 別の名前で設定済みなら、上書きしてよいか確認する
const { config } = readWranglerConfig();
const d1Index = getD1Index(config);
if (isConfigured(config) && config.name !== workerName) {
  const answer = await prompt(
    `\n${WRANGLER_CONFIG} は既に「${config.name}」で設定されています。「${workerName}」で上書きしますか？ (y/N): `,
  );
  if (answer.toLowerCase() !== "y") fail("中止しました。");
}

// D1 を作成する（作成済みなら再利用する）
let database = listD1Databases().find((db) => db.name === databaseName);
if (database) {
  console.log(`\nD1「${databaseName}」は作成済みです（${database.uuid}）。そのまま使います。`);
} else {
  wrangler(["d1", "create", databaseName]);
  database = listD1Databases().find((db) => db.name === databaseName);
  if (!database) fail(`D1「${databaseName}」の作成を確認できませんでした。`);
}

updateWranglerConfig([
  [["name"], workerName],
  [["d1_databases", d1Index, "database_name"], databaseName],
  [["d1_databases", d1Index, "database_id"], database.uuid],
]);
console.log(`\n${WRANGLER_CONFIG} を更新しました。`);

wrangler(["d1", "migrations", "apply", DB_BINDING, "--local"]);

console.log(`
セットアップが完了しました。
  開発サーバー: npm run dev → http://localhost:8787
  デプロイ    : npm run deploy
`);
