// D1 の動きのうち、設計（docs/db/README.md・queries.md）が前提にしているものを確かめる。
// 0002 をリモートに当てる前に確かめること（docs/harness.md 4章）の記録でもある。

import { describe, expect, it } from "vitest";
import { createCompany } from "../../src/repo/companies.ts";
import { createContact } from "../../src/repo/contacts.ts";
import { createRecipient, createUser, db, insertMemo, NOW, uniqueEmail } from "../fixtures.ts";

const COMPANY = { name: "原田電気", kana: "はらだでんき", phone: "", memo: "" };
const CONTACT = { name: "原田", kana: "はらだ", phone: "0312345678", memo: "" };

async function queryPlan(sql: string, ...values: unknown[]): Promise<string> {
  const { results } = await db
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .bind(...values)
    .all<{ detail: string }>();
  return results.map((row) => row.detail).join("\n");
}

describe("db.batch()", () => {
  it("途中の文が失敗したら、先に流した文も取り消される", async () => {
    const email = uniqueEmail();
    const batch = db.batch([
      db.prepare("INSERT INTO users (email, name) VALUES (?1, ?2)").bind(email, "菊地"),
      // name が空なので CHECK に当たる
      db.prepare("INSERT INTO users (email, name) VALUES (?1, ?2)").bind(uniqueEmail(), ""),
    ]);
    await expect(batch).rejects.toThrow(/CHECK constraint failed/);

    const row = await db.prepare("SELECT id FROM users WHERE email = ?1").bind(email).first();
    expect(row).toBeNull();
  });

  it("文ごとの変わった行数が、結果の meta.changes で分かる", async () => {
    const userId = await createUser();
    const companyId = await createCompany(db, COMPANY, userId, NOW);
    const [hit, miss] = await db.batch([
      db.prepare("UPDATE companies SET memo = 'x' WHERE id = ?1").bind(companyId),
      db.prepare("UPDATE companies SET memo = 'x' WHERE id = ?1").bind(-1),
    ]);
    expect(hit?.meta.changes).toBe(1);
    expect(miss?.meta.changes).toBe(0);
  });
});

describe("取次可否の UPSERT（queries.md 3.4）", () => {
  const UPSERT = `
    INSERT INTO company_settings (company_id, recipient_id, value, created_at, updated_by, updated_at)
    SELECT ?1, ?2, ?3, ?4, ?5, ?4
    WHERE EXISTS (SELECT 1 FROM companies WHERE id = ?1 AND deleted_at IS NULL)
      AND EXISTS (SELECT 1 FROM recipients WHERE id = ?2 AND deleted_at IS NULL)
    ON CONFLICT (company_id, recipient_id) DO UPDATE
      SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at
      WHERE company_settings.value <> excluded.value`;

  it("更新では created_at を変えず、同じ値では更新者も変えない", async () => {
    const first = await createUser("菊地");
    const second = await createUser("益岡");
    const companyId = await createCompany(db, COMPANY, first, NOW);
    const recipientId = await createRecipient();
    const t1 = "2026-11-05T05:30:00.000Z";
    const t2 = "2026-11-06T01:00:00.000Z";
    const t3 = "2026-11-07T01:00:00.000Z";
    const current = () =>
      db
        .prepare("SELECT value, created_at, updated_by, updated_at FROM company_settings WHERE company_id = ?1")
        .bind(companyId)
        .first();

    const inserted = await db.prepare(UPSERT).bind(companyId, recipientId, "connect", t1, first).run();
    expect(inserted.meta.changes).toBe(1);
    expect(await current()).toEqual({ value: "connect", created_at: t1, updated_by: first, updated_at: t1 });

    // 値が変わる：値・更新者・更新日時だけが変わる
    const changed = await db.prepare(UPSERT).bind(companyId, recipientId, "decline", t2, second).run();
    expect(changed.meta.changes).toBe(1);
    expect(await current()).toEqual({ value: "decline", created_at: t1, updated_by: second, updated_at: t2 });

    // 同じ値：何も変わらない
    const same = await db.prepare(UPSERT).bind(companyId, recipientId, "decline", t3, first).run();
    expect(same.meta.changes).toBe(0);
    expect(await current()).toEqual({ value: "decline", created_at: t1, updated_by: second, updated_at: t2 });
  });

  it("削除された宛先には行を作らない", async () => {
    const userId = await createUser();
    const companyId = await createCompany(db, COMPANY, userId, NOW);
    const recipientId = await createRecipient();
    await db.prepare("UPDATE recipients SET deleted_at = ?2 WHERE id = ?1").bind(recipientId, NOW.toISOString()).run();

    const result = await db.prepare(UPSERT).bind(companyId, recipientId, "connect", NOW.toISOString(), userId).run();
    expect(result.meta.changes).toBe(0);
  });
});

describe("実行計画：一覧が部分インデックスを使い、並べ替えをしない（queries.md 4章）", () => {
  it("会社一覧", async () => {
    const plan = await queryPlan(
      `SELECT c.id, c.name, c.kana,
              (SELECT count(*) FROM contacts p WHERE p.company_id = c.id AND p.deleted_at IS NULL) AS contact_count
       FROM companies c WHERE c.deleted_at IS NULL ORDER BY c.kana, c.id`,
    );
    expect(plan).toContain("USING INDEX companies_active_kana");
    expect(plan).toMatch(/USING (COVERING )?INDEX contacts_active_company/);
    expect(plan).not.toContain("TEMP B-TREE");
  });

  it("相手の検索", async () => {
    const plan = await queryPlan(
      `SELECT c.id, p.id FROM companies c
       LEFT JOIN contacts p ON p.company_id = c.id AND p.deleted_at IS NULL
       WHERE c.deleted_at IS NULL
         AND (instr(c.name, ?1) > 0 OR instr(c.kana, ?1) > 0
              OR instr(p.name, ?1) > 0 OR instr(p.kana, ?1) > 0 OR instr(p.phone, ?1) > 0)
       ORDER BY c.kana, c.id, p.id`,
      "原田",
    );
    expect(plan).toContain("USING INDEX companies_active_kana");
    expect(plan).toContain("USING INDEX contacts_active_company");
    expect(plan).not.toContain("TEMP B-TREE");
  });

  it("取次メモ一覧（条件なし）", async () => {
    const plan = await queryPlan(
      `SELECT m.id FROM memos m WHERE m.deleted_at IS NULL
       ORDER BY m.received_at DESC, m.created_at DESC, m.id DESC LIMIT 50 OFFSET 0`,
    );
    expect(plan).toContain("USING INDEX memos_active_received");
    expect(plan).not.toContain("TEMP B-TREE");
  });

  it("取次メモ一覧（宛先と期間）", async () => {
    const plan = await queryPlan(
      `SELECT m.id FROM memos m
       WHERE m.deleted_at IS NULL AND m.recipient_id = ?1 AND m.received_at >= ?2 AND m.received_at < ?3
       ORDER BY m.received_at DESC, m.created_at DESC, m.id DESC LIMIT 50 OFFSET 0`,
      1,
      "2026-11-04T15:00:00.000Z",
      "2026-11-05T15:00:00.000Z",
    );
    expect(plan).toContain(
      "USING INDEX memos_active_recipient_received (recipient_id=? AND received_at>? AND received_at<?)",
    );
    expect(plan).not.toContain("TEMP B-TREE");
  });
});

describe("取次メモ一覧：件数と 1 ページ分を batch で一緒に取る（queries.md 2.3）", () => {
  it("件数と、新しい順の 1 ページ分が取れる", async () => {
    const userId = await createUser();
    const recipientId = await createRecipient();
    const older = await insertMemo(
      { recipient_id: recipientId, created_by: userId },
      { received_at: "2026-11-04T01:00:00.000Z" },
    );
    const newer = await insertMemo(
      { recipient_id: recipientId, created_by: userId },
      { received_at: "2026-11-05T01:00:00.000Z" },
    );

    const [page, count] = await db.batch<{ id?: number; n?: number }>([
      db
        .prepare(
          `SELECT m.id FROM memos m WHERE m.deleted_at IS NULL AND m.recipient_id = ?1
           ORDER BY m.received_at DESC, m.created_at DESC, m.id DESC LIMIT 50 OFFSET 0`,
        )
        .bind(recipientId),
      db
        .prepare("SELECT count(*) AS n FROM memos m WHERE m.deleted_at IS NULL AND m.recipient_id = ?1")
        .bind(recipientId),
    ]);
    expect(page?.results.map((row) => row.id)).toEqual([newer, older]);
    expect(count?.results[0]?.n).toBe(2);
  });
});

describe("担当者の登録（queries.md 3.2）", () => {
  it("INSERT … SELECT … WHERE EXISTS … RETURNING で、削除済みの会社には登録されない", async () => {
    const userId = await createUser();
    const companyId = await createCompany(db, COMPANY, userId, NOW);
    expect(await createContact(db, companyId, CONTACT, userId, NOW)).toEqual(expect.any(Number));

    await db.prepare("UPDATE companies SET deleted_at = ?2 WHERE id = ?1").bind(companyId, NOW.toISOString()).run();
    expect(await createContact(db, companyId, CONTACT, userId, NOW)).toBeNull();
  });
});
