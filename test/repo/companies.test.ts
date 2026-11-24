import { describe, expect, it } from "vitest";
import { createCompany, deleteCompany, findCompany, listCompanies, updateCompany } from "../../src/repo/companies.ts";
import { createContact, deleteContact } from "../../src/repo/contacts.ts";
import { createUser, db, NOW } from "../fixtures.ts";

const CONTACT = { name: "原田", kana: "はらだ", phone: "0312345678", memo: "" };

// ほかのテストの会社と混ざらないように、テストごとに違う語をよみがなに入れる
function uniqueKana(): string {
  return `てすと${crypto.randomUUID()}`;
}

function contactRows(companyId: number) {
  return db
    .prepare("SELECT id, deleted_at, updated_by, updated_at FROM contacts WHERE company_id = ?1 ORDER BY id")
    .bind(companyId)
    .all<{ id: number; deleted_at: string | null; updated_by: number; updated_at: string }>()
    .then(({ results }) => results);
}

function companyRow(id: number) {
  return db
    .prepare("SELECT deleted_at, updated_by, updated_at FROM companies WHERE id = ?1")
    .bind(id)
    .first<{ deleted_at: string | null; updated_by: number; updated_at: string }>();
}

describe("createCompany / findCompany / updateCompany", () => {
  it("登録すると、更新者と更新日時が記録される", async () => {
    const userId = await createUser("菊地");
    const id = await createCompany(
      db,
      { name: "原田電気", kana: "はらだでんき", phone: "", memo: "メモ" },
      userId,
      NOW,
    );

    expect(await findCompany(db, id)).toEqual({
      id,
      name: "原田電気",
      kana: "はらだでんき",
      phone: "",
      memo: "メモ",
      created_at: NOW.toISOString(),
      updated_by: userId,
      updated_at: NOW.toISOString(),
      deleted_at: null,
      updated_by_name: "菊地",
    });
  });

  it("編集すると、更新者と更新日時が変わり、作成日時は変わらない", async () => {
    const first = await createUser("菊地");
    const second = await createUser("益岡");
    const id = await createCompany(db, { name: "原田電気", kana: "はらだでんき", phone: "", memo: "" }, first, NOW);
    const later = new Date("2026-11-06T01:00:00.000Z");

    const updated = await updateCompany(
      db,
      id,
      { name: "原田電機", kana: "はらだでんき", phone: "0312345678", memo: "" },
      second,
      later,
    );
    expect(updated).toBe(true);
    expect(await findCompany(db, id)).toMatchObject({
      name: "原田電機",
      phone: "0312345678",
      created_at: NOW.toISOString(),
      updated_by: second,
      updated_at: later.toISOString(),
      updated_by_name: "益岡",
    });
  });

  it("存在しない会社は、取れず、編集もできない", async () => {
    const userId = await createUser();
    expect(await findCompany(db, -1)).toBeNull();
    expect(await updateCompany(db, -1, { name: "", kana: "あ", phone: "", memo: "" }, userId, NOW)).toBe(false);
  });
});

describe("listCompanies", () => {
  it("よみがな順（同じなら登録順）で、削除されていない担当者の数と一緒に返す", async () => {
    const userId = await createUser();
    const key = uniqueKana();
    const b = await createCompany(db, { name: "B", kana: `${key}い`, phone: "", memo: "" }, userId, NOW);
    const a1 = await createCompany(db, { name: "A1", kana: `${key}あ`, phone: "", memo: "" }, userId, NOW);
    const a2 = await createCompany(db, { name: "A2", kana: `${key}あ`, phone: "", memo: "" }, userId, NOW);
    await createContact(db, a1, CONTACT, userId, NOW);
    const removed = await createContact(db, a1, CONTACT, userId, NOW);
    if (removed === null) throw new Error("createContact failed");
    await deleteContact(db, removed, userId, NOW);

    expect(await listCompanies(db, key)).toEqual([
      { id: a1, name: "A1", kana: `${key}あ`, contact_count: 1 },
      { id: a2, name: "A2", kana: `${key}あ`, contact_count: 0 },
      { id: b, name: "B", kana: `${key}い`, contact_count: 0 },
    ]);
  });

  it("会社名・よみがなの部分一致で絞り込む。入力どおりに比べる（大文字と小文字、ひらがなとカタカナを区別する）", async () => {
    const userId = await createUser();
    const key = uniqueKana();
    const id = await createCompany(
      db,
      { name: `ABC商事${key}`, kana: `${key}えーびーしー`, phone: "", memo: "" },
      userId,
      NOW,
    );
    const ids = async (keyword: string) => (await listCompanies(db, keyword)).map((company) => company.id);

    expect(await ids(`ABC商事${key}`)).toEqual([id]);
    expect(await ids(`${key}えーびー`)).toEqual([id]);
    expect(await ids(`abc商事${key}`)).toEqual([]);
    expect(await ids(`${key}エービー`)).toEqual([]);
  });

  it("検索欄が空なら、削除されていない会社をすべて返す。削除された会社は返さない", async () => {
    const userId = await createUser();
    const kept = await createCompany(db, { name: "残す", kana: uniqueKana(), phone: "", memo: "" }, userId, NOW);
    const removed = await createCompany(db, { name: "消す", kana: uniqueKana(), phone: "", memo: "" }, userId, NOW);
    await deleteCompany(db, removed, userId, NOW);

    const ids = (await listCompanies(db)).map((company) => company.id);
    expect(ids).toContain(kept);
    expect(ids).not.toContain(removed);
  });
});

describe("deleteCompany", () => {
  it("会社と、所属する担当者に、同じ削除日時・更新者・更新日時が入る", async () => {
    const creator = await createUser("菊地");
    const deleter = await createUser("益岡");
    const id = await createCompany(db, { name: "原田電気", kana: uniqueKana(), phone: "", memo: "" }, creator, NOW);
    await createContact(db, id, CONTACT, creator, NOW);
    await createContact(db, id, CONTACT, creator, NOW);
    const at = new Date("2026-11-07T02:00:00.000Z");

    expect(await deleteCompany(db, id, deleter, at)).toBe(true);

    const expected = { deleted_at: at.toISOString(), updated_by: deleter, updated_at: at.toISOString() };
    expect(await companyRow(id)).toEqual(expected);
    expect(await contactRows(id)).toEqual([expect.objectContaining(expected), expect.objectContaining(expected)]);
    expect(await findCompany(db, id)).toBeNull();
  });

  it("先に個別に削除されていた担当者の削除日時は、そのまま残る", async () => {
    const userId = await createUser();
    const id = await createCompany(db, { name: "原田電気", kana: uniqueKana(), phone: "", memo: "" }, userId, NOW);
    const early = await createContact(db, id, CONTACT, userId, NOW);
    const together = await createContact(db, id, CONTACT, userId, NOW);
    if (early === null) throw new Error("createContact failed");
    const earlier = new Date("2026-11-06T01:00:00.000Z");
    const at = new Date("2026-11-07T02:00:00.000Z");
    await deleteContact(db, early, userId, earlier);

    expect(await deleteCompany(db, id, userId, at)).toBe(true);

    expect(await contactRows(id)).toEqual([
      expect.objectContaining({ id: early, deleted_at: earlier.toISOString() }),
      expect.objectContaining({ id: together, deleted_at: at.toISOString() }),
    ]);
  });

  it("同じ時刻に個別に削除された担当者がいるときは、時刻を 1 ミリ秒進めて削除する", async () => {
    const userId = await createUser();
    const id = await createCompany(db, { name: "原田電気", kana: uniqueKana(), phone: "", memo: "" }, userId, NOW);
    const early = await createContact(db, id, CONTACT, userId, NOW);
    const together = await createContact(db, id, CONTACT, userId, NOW);
    if (early === null) throw new Error("createContact failed");
    const at = new Date("2026-11-07T02:00:00.000Z");
    await deleteContact(db, early, userId, at);

    expect(await deleteCompany(db, id, userId, at)).toBe(true);

    // 会社と、一緒に削除された担当者は 1 ミリ秒あと。個別に削除された担当者と見分けられる
    expect((await companyRow(id))?.deleted_at).toBe("2026-11-07T02:00:00.001Z");
    expect(await contactRows(id)).toEqual([
      expect.objectContaining({ id: early, deleted_at: "2026-11-07T02:00:00.000Z" }),
      expect.objectContaining({ id: together, deleted_at: "2026-11-07T02:00:00.001Z" }),
    ]);
  });

  it("削除済み・存在しない会社は false で、削除日時を上書きしない", async () => {
    const userId = await createUser();
    const id = await createCompany(db, { name: "原田電気", kana: uniqueKana(), phone: "", memo: "" }, userId, NOW);
    const at = new Date("2026-11-07T02:00:00.000Z");
    await deleteCompany(db, id, userId, at);

    expect(await deleteCompany(db, id, userId, new Date("2026-11-08T02:00:00.000Z"))).toBe(false);
    expect((await companyRow(id))?.deleted_at).toBe(at.toISOString());
    expect(await deleteCompany(db, -1, userId, at)).toBe(false);
  });
});
