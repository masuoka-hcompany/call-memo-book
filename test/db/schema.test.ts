// src/repo/schema.ts（行の型のもと）が、マイグレーションを当てた DB と合っていることを確かめる。
// マイグレーションだけ直して schema.ts を直し忘れると、ここで落ちる。

import { describe, expect, it } from "vitest";
import { type Column, SCHEMA, type TableName } from "../../src/repo/schema.ts";
import { db } from "../fixtures.ts";

// SCHEMA に入れないテーブル：テンプレートの items（本実装で消す）と、D1・SQLite が使うテーブル
const IGNORED_TABLES = ["items", "d1_migrations"];

type TableInfo = { name: string; type: string; notnull: number; pk: number };

const TABLES = Object.keys(SCHEMA) as TableName[];

describe("src/repo/schema.ts と DB", () => {
  it("テーブルの一覧が同じ", async () => {
    const { results } = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name",
      )
      .all<{ name: string }>();
    const actual = results.map((row) => row.name).filter((name) => !IGNORED_TABLES.includes(name));
    expect(actual).toEqual([...TABLES].sort());
  });

  it.each(TABLES)("%s：列の名前・順番・型・NULL を許すかが同じ", async (table) => {
    const { results } = await db.prepare(`PRAGMA table_info(${table})`).all<TableInfo>();
    const actual = results.map((column) => ({
      name: column.name,
      type: column.type,
      // 主キーの列は、NOT NULL と書いていなくても NULL にならない（INTEGER PRIMARY KEY）
      nullable: column.notnull === 0 && column.pk === 0,
    }));
    const columns: Record<string, Column> = SCHEMA[table];
    const expected = Object.entries(columns).map(([name, column]) => ({
      name,
      type: column.type,
      nullable: column.nullable,
    }));
    expect(actual).toEqual(expected);
  });

  it.each(TABLES)("%s：区分の値が CHECK と同じ", async (table) => {
    const row = await db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1")
      .bind(table)
      .first<{ sql: string }>();
    const columns: Record<string, Column> = SCHEMA[table];
    for (const [name, column] of Object.entries(columns)) {
      if (!column.values) continue;
      const list = column.values.map((value) => `'${value}'`).join(", ");
      expect(row?.sql).toContain(`CHECK (${name} IN (${list}))`);
    }
  });
});
