// マイグレーションの決まり（docs/migrations.md）を確かめる。
// ファイルや git には触らない（読むのは scripts/check-migrations.ts）。テストは test/scripts/migrations-rules.test.ts。

export type MigrationFile = {
  // ファイル名（例：0002_create_step1_tables.sql）
  name: string;
  // 中身が同じかを比べるための値（git の blob のハッシュ）
  hash: string;
  // 中身。禁止している書き方を調べるときに使う（比べる元のファイルでは省く）
  sql?: string;
};

export type CheckInput = {
  // 今の migrations/ にある .sql ファイル
  current: MigrationFile[];
  // migrations/APPLIED の中身（リモートに当てた最後の番号）。ファイルがなければ null
  applied: string | null;
  // 比べる元（main）の .sql ファイルと APPLIED。比べる元が分からないときは null（比べる検査を飛ばす）
  base: { files: MigrationFile[]; applied: string | null } | null;
};

const NAME_PATTERN = /^(\d{4})_[a-z0-9][a-z0-9_-]*\.sql$/;
const APPLIED_PATTERN = /^\d{4}$/;

// D1 のマイグレーションに書かない文（効かない・エラーになる・D1 がまとめて反映するので要らない）
const FORBIDDEN_STATEMENTS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\bPRAGMA\s+foreign_keys\b/i,
    reason:
      "PRAGMA foreign_keys は D1 では効かない（外部キーの確認を遅らせるには PRAGMA defer_foreign_keys = on を使う）",
  },
  {
    pattern: /\bBEGIN\s*(;|TRANSACTION\b|DEFERRED\b|IMMEDIATE\b|EXCLUSIVE\b)/i,
    reason: "BEGIN は書かない（D1 がマイグレーションごとにまとめて反映する）",
  },
  {
    pattern: /\b(COMMIT|ROLLBACK)\b/i,
    reason: "COMMIT・ROLLBACK は書かない（D1 がマイグレーションごとにまとめて反映する）",
  },
  { pattern: /\bSAVEPOINT\b/i, reason: "SAVEPOINT は書かない（D1 でエラーになる）" },
];

function numberOf(name: string): string | undefined {
  return NAME_PATTERN.exec(name)?.[1];
}

// コメント（-- と /* */）を取り除く。コメントの中の語を、禁止している文と間違えないため
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, " ");
}

// 決まりに合わない点を、メッセージの配列で返す（空なら問題なし）
export function checkMigrations({ current, applied, base }: CheckInput): string[] {
  const errors: string[] = [];

  // 1. ファイル名と番号
  const byNumber = new Map<string, string[]>();
  for (const { name } of current) {
    const number = numberOf(name);
    if (!number) {
      errors.push(`${name}：ファイル名は「4桁の番号_名前.sql」にする（例：0003_add_xxx.sql）`);
      continue;
    }
    byNumber.set(number, [...(byNumber.get(number) ?? []), name]);
  }
  for (const [number, names] of byNumber) {
    if (names.length > 1) {
      errors.push(`番号 ${number} が重なっている（${names.join("、")}）。あとから足すほうの番号を付け直す`);
    }
  }

  // 2. APPLIED（リモートに当てた最後の番号）
  if (applied === null) {
    errors.push("migrations/APPLIED がない（リモートに当てた最後の番号を 4 桁で書く。1つも当てていなければ 0000）");
    return errors;
  }
  if (!APPLIED_PATTERN.test(applied)) {
    errors.push(`migrations/APPLIED の中身「${applied}」は 4 桁の番号ではない`);
    return errors;
  }
  if (applied !== "0000" && !byNumber.has(applied)) {
    errors.push(`migrations/APPLIED の番号 ${applied} のマイグレーションがない`);
  }

  // 3. まだ当てていないマイグレーションの中身
  for (const { name, sql } of current) {
    const number = numberOf(name);
    if (!number || number <= applied || sql === undefined) continue;
    const body = stripComments(sql);
    for (const { pattern, reason } of FORBIDDEN_STATEMENTS) {
      if (pattern.test(body)) errors.push(`${name}：${reason}`);
    }
  }

  // 4. 比べる元（main）との違い
  if (!base) return errors;

  if (base.applied !== null && APPLIED_PATTERN.test(base.applied) && applied < base.applied) {
    errors.push(`migrations/APPLIED が ${base.applied} から ${applied} に戻っている`);
  }

  const currentByName = new Map(current.map((file) => [file.name, file]));
  for (const baseFile of base.files) {
    const number = numberOf(baseFile.name);
    if (!number || number > applied) continue;
    const now = currentByName.get(baseFile.name);
    if (!now) {
      errors.push(
        `${baseFile.name}：リモートに当てたマイグレーションが消されている（名前の変更も不可）。直すときは新しいマイグレーションを足す`,
      );
    } else if (now.hash !== baseFile.hash) {
      errors.push(
        `${baseFile.name}：リモートに当てたマイグレーションが書き換えられている。直すときは新しいマイグレーションを足す`,
      );
    }
  }

  const baseNames = new Set(base.files.map((file) => file.name));
  for (const { name } of current) {
    const number = numberOf(name);
    if (!number || baseNames.has(name)) continue;
    if (number <= applied) {
      errors.push(
        `${name}：新しいマイグレーションの番号が、リモートに当てた番号（${applied}）以下になっている。当てた番号より大きい番号にする`,
      );
    }
  }

  return errors;
}
