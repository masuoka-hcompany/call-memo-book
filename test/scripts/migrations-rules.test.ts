import { describe, expect, it } from "vitest";
import { type CheckInput, checkMigrations, type MigrationFile } from "../../scripts/migrations-rules.ts";

function file(name: string, sql = "CREATE TABLE t (id INTEGER PRIMARY KEY);"): MigrationFile {
  // テストでは、中身そのものをハッシュの代わりにする（中身が同じなら同じ値になればよい）
  return { name, hash: sql, sql };
}

const ITEMS = file("0001_create_items.sql");
const STEP1 = file("0002_create_step1_tables.sql");

// main：0001 と 0002 があり、リモートに当てたのは 0001 まで
const BASE: CheckInput["base"] = { files: [ITEMS, STEP1], applied: "0001" };

function check(input: Partial<CheckInput>): string[] {
  return checkMigrations({ current: [ITEMS, STEP1], applied: "0001", base: BASE, ...input });
}

describe("checkMigrations", () => {
  it("main と同じなら問題なし", () => {
    expect(check({})).toEqual([]);
  });

  it("新しい番号のマイグレーションを足せる", () => {
    expect(check({ current: [ITEMS, STEP1, file("0003_drop_items.sql", "DROP TABLE items;")] })).toEqual([]);
  });

  it("まだ当てていないマイグレーション（0002）は書き換えられる", () => {
    const fixed = file(STEP1.name, "CREATE TABLE fixed (id INTEGER PRIMARY KEY);");
    expect(check({ current: [ITEMS, fixed] })).toEqual([]);
  });

  describe("リモートに当てたマイグレーション", () => {
    it("書き換えるとエラー", () => {
      const changed = file(ITEMS.name, "CREATE TABLE items (id INTEGER);");
      expect(check({ current: [changed, STEP1] })).toEqual([expect.stringContaining("書き換えられている")]);
    });

    it("消すとエラー", () => {
      const errors = check({ current: [STEP1] });
      expect(errors).toContainEqual(
        expect.stringContaining("0001_create_items.sql：リモートに当てたマイグレーションが消されている"),
      );
    });

    it("名前を変えるとエラー（消して足したことになる）", () => {
      const renamed = file("0001_items.sql", ITEMS.sql);
      const errors = check({ current: [renamed, STEP1] });
      expect(errors).toContainEqual(expect.stringContaining("消されている"));
      expect(errors).toContainEqual(expect.stringContaining("当てた番号より大きい番号にする"));
    });

    it("APPLIED を進めた PR では、その番号までが書き換えられなくなる", () => {
      const fixed = file(STEP1.name, "CREATE TABLE fixed (id INTEGER PRIMARY KEY);");
      expect(check({ current: [ITEMS, fixed], applied: "0002" })).toEqual([
        expect.stringContaining("書き換えられている"),
      ]);
    });
  });

  describe("番号とファイル名", () => {
    it("同じ番号が 2 つあるとエラー", () => {
      const errors = check({ current: [ITEMS, STEP1, file("0002_another.sql")] });
      expect(errors).toEqual([expect.stringContaining("番号 0002 が重なっている")]);
    });

    it("当てた番号以下の新しいマイグレーションはエラー", () => {
      const errors = check({ current: [file("0000_first.sql"), ITEMS, STEP1] });
      expect(errors).toEqual([expect.stringContaining("当てた番号より大きい番号にする")]);
    });

    it.each(["3_add.sql", "0003.sql", "0003_Add.sql", "0003_add.SQL", "add_0003.sql"])(
      "ファイル名 %s はエラー",
      (name) => {
        expect(check({ current: [ITEMS, STEP1, file(name)] })).toEqual([expect.stringContaining("4桁の番号_名前.sql")]);
      },
    );
  });

  describe("APPLIED", () => {
    it("ファイルがないとエラー", () => {
      expect(check({ applied: null })).toEqual([expect.stringContaining("migrations/APPLIED がない")]);
    });

    it.each(["1", "00001", "abcd", ""])("中身 %j は 4 桁の番号ではないのでエラー", (applied) => {
      expect(check({ applied })).toEqual([expect.stringContaining("4 桁の番号ではない")]);
    });

    it("その番号のマイグレーションがないとエラー", () => {
      expect(check({ applied: "0005", base: null })).toEqual([
        expect.stringContaining("番号 0005 のマイグレーションがない"),
      ]);
    });

    it("1つも当てていないときは 0000 と書ける", () => {
      expect(check({ applied: "0000", base: { files: [ITEMS, STEP1], applied: "0000" } })).toEqual([]);
    });

    it("main より前の番号に戻すとエラー", () => {
      const errors = check({ applied: "0001", base: { files: [ITEMS, STEP1], applied: "0002" } });
      expect(errors).toEqual([expect.stringContaining("0002 から 0001 に戻っている")]);
    });
  });

  describe("まだ当てていないマイグレーションの中身", () => {
    it.each([
      ["PRAGMA foreign_keys = OFF;", "PRAGMA foreign_keys は D1 では効かない"],
      ["pragma foreign_keys=off;", "PRAGMA foreign_keys は D1 では効かない"],
      ["BEGIN TRANSACTION;\nDROP TABLE items;", "BEGIN は書かない"],
      ["BEGIN;\nDROP TABLE items;", "BEGIN は書かない"],
      ["DROP TABLE items;\nCOMMIT;", "COMMIT・ROLLBACK は書かない"],
      ["SAVEPOINT s;\nDROP TABLE items;", "SAVEPOINT は書かない"],
    ])("%j はエラー", (sql, message) => {
      const errors = check({ current: [ITEMS, STEP1, file("0003_x.sql", sql)] });
      expect(errors).toContainEqual(expect.stringContaining(`0003_x.sql：${message}`));
    });

    it.each([
      ["PRAGMA defer_foreign_keys = on;\nDROP TABLE items;"],
      ["-- BEGIN〜COMMIT は書かない\nDROP TABLE items;"],
      ["/* PRAGMA foreign_keys = OFF は効かない */\nDROP TABLE items;"],
      ["CREATE TRIGGER trg AFTER INSERT ON t BEGIN\n  UPDATE t SET n = 1;\nEND;"],
    ])("%j は問題なし", (sql) => {
      expect(check({ current: [ITEMS, STEP1, file("0003_x.sql", sql)] })).toEqual([]);
    });

    it("リモートに当てたマイグレーションの中身は調べない（もう直せないため）", () => {
      const applied = file(ITEMS.name, "BEGIN TRANSACTION;\nCREATE TABLE items (id INTEGER);\nCOMMIT;");
      expect(check({ current: [applied, STEP1], base: { files: [applied, STEP1], applied: "0001" } })).toEqual([]);
    });
  });

  it("比べる元が分からないときは、今のファイルだけで分かることを確かめる", () => {
    expect(check({ base: null })).toEqual([]);
    expect(check({ base: null, current: [ITEMS, STEP1, file("0002_another.sql")] })).toEqual([
      expect.stringContaining("番号 0002 が重なっている"),
    ]);
  });
});
