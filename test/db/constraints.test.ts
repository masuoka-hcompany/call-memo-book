// DB の制約（CHECK・一意・外部キー）が、決まりに合わない値を弾くことを確かめる。
// 制約は「最後の守り」で、エラーメッセージを出す入力チェックは src/domain/ で行う（docs/db/README.md 1.4）。
// ここでは、アプリの誤りやエンジニアの直接操作で、データの決まりが崩れないことを確かめる。

import { describe, expect, it } from "vitest";
import { createCompany } from "../../src/repo/companies.ts";
import { createContact } from "../../src/repo/contacts.ts";
import { findUserByEmail } from "../../src/repo/users.ts";
import { createRecipient, createUser, db, insertMemo, NOW, uniqueEmail } from "../fixtures.ts";

const CHECK = /CHECK constraint failed/;
const FOREIGN_KEY = /FOREIGN KEY constraint failed/;
const UNIQUE = /UNIQUE constraint failed/;

const COMPANY = { name: "原田電気", kana: "はらだでんき", phone: "", memo: "" };
const CONTACT = { name: "原田", kana: "はらだ", phone: "0312345678", memo: "" };

function insertCompany(userId: number, overrides: Record<string, unknown> = {}) {
  const company = {
    ...COMPANY,
    created_at: NOW.toISOString(),
    updated_by: userId,
    updated_at: NOW.toISOString(),
    ...overrides,
  };
  const columns = Object.keys(company);
  return db
    .prepare(`INSERT INTO companies (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
    .bind(...Object.values(company))
    .run();
}

describe("メールアドレス（大文字・小文字を区別しない）", () => {
  it("大文字・小文字だけが違う利用者は登録できない", async () => {
    const email = uniqueEmail("Kikuchi");
    await createUser("菊地", email);
    await expect(createUser("菊地", email.toUpperCase())).rejects.toThrow(/UNIQUE constraint failed: users\.email/);
  });

  it("大文字・小文字が違っても、同じ利用者が取れる", async () => {
    const email = uniqueEmail("Kikuchi");
    const id = await createUser("菊地", email);
    expect((await findUserByEmail(db, email.toUpperCase()))?.id).toBe(id);
  });

  it("同じメールアドレスの宛先は 1 件だけ（削除済みを含む）", async () => {
    const email = uniqueEmail("recipient");
    const id = await createRecipient("菊地", email);
    await db.prepare("UPDATE recipients SET deleted_at = ?2 WHERE id = ?1").bind(id, NOW.toISOString()).run();
    await expect(createRecipient("菊地", email)).rejects.toThrow(UNIQUE);
  });
});

describe("日時の形（UTC の toISOString() の形だけを受け付ける）", () => {
  it("toISOString() の形は入る", async () => {
    const userId = await createUser();
    await expect(insertCompany(userId, { updated_at: "2026-11-05T05:30:00.000Z" })).resolves.toBeDefined();
  });

  it.each([
    ["日時でない", "abc"],
    ["空文字", ""],
    ["T と Z がない", "2026-11-05 05:30:00"],
    ["ミリ秒がない", "2026-11-05T05:30:00Z"],
    ["タイムゾーンが +09:00", "2026-11-05T14:30:00.000+09:00"],
    ["24 時", "2026-11-05T24:00:00.000Z"],
    ["ない日付", "2026-02-30T00:00:00.000Z"],
  ])("%s（%j）は入らない", async (_, value) => {
    const userId = await createUser();
    await expect(insertCompany(userId, { updated_at: value })).rejects.toThrow(CHECK);
  });

  it("受電日時は分単位（秒・ミリ秒が 0 でないと入らない）", async () => {
    const userId = await createUser();
    const recipientId = await createRecipient();
    const required = { recipient_id: recipientId, created_by: userId };
    await expect(insertMemo(required, { received_at: "2026-11-05T05:30:00.000Z" })).resolves.toEqual(
      expect.any(Number),
    );
    await expect(insertMemo(required, { received_at: "2026-11-05T05:30:15.000Z" })).rejects.toThrow(CHECK);
    await expect(insertMemo(required, { received_at: "2026-11-05T05:30:00.500Z" })).rejects.toThrow(CHECK);
  });
});

describe("文字数（全角・半角を区別せず 1 文字）と必須", () => {
  it.each([
    ["半角", "a"],
    ["全角", "あ"],
    ["UTF-16 で 2 つ分になる文字", "𠮷"],
  ])("会社名は %s でも 255 文字まで入り、256 文字は入らない", async (_, char) => {
    const userId = await createUser();
    await expect(insertCompany(userId, { name: char.repeat(255) })).resolves.toBeDefined();
    await expect(insertCompany(userId, { name: char.repeat(256) })).rejects.toThrow(CHECK);
  });

  it("メモは 1,000 文字まで入り、1,001 文字は入らない", async () => {
    const userId = await createUser();
    await expect(insertCompany(userId, { memo: "あ".repeat(1000) })).resolves.toBeDefined();
    await expect(insertCompany(userId, { memo: "あ".repeat(1001) })).rejects.toThrow(CHECK);
  });

  it("会社名は空でよいが、よみがなは空にできない", async () => {
    const userId = await createUser();
    await expect(insertCompany(userId, { name: "" })).resolves.toBeDefined();
    await expect(insertCompany(userId, { kana: "" })).rejects.toThrow(CHECK);
  });
});

describe("電話番号（半角数字のみ・15 桁以内）", () => {
  it.each([
    ["ハイフン入り", "03-1234-5678"],
    ["全角数字", "０３１２３４５６７８"],
    ["16 桁", "1234567890123456"],
  ])("%s（%j）は入らない", async (_, phone) => {
    const userId = await createUser();
    await expect(insertCompany(userId, { phone })).rejects.toThrow(CHECK);
  });

  it("15 桁は入る。会社の電話番号は空でよいが、担当者は必須", async () => {
    const userId = await createUser();
    await expect(insertCompany(userId, { phone: "123456789012345" })).resolves.toBeDefined();
    const companyId = await createCompany(db, COMPANY, userId, NOW);
    await expect(createContact(db, companyId, { ...CONTACT, phone: "" }, userId, NOW)).rejects.toThrow(CHECK);
  });
});

describe("区分の値", () => {
  it("決まった値以外は入らない", async () => {
    const userId = await createUser();
    const recipientId = await createRecipient();
    const required = { recipient_id: recipientId, created_by: userId };
    // 型では書けない値を、DB が弾くことを確かめる
    await expect(insertMemo(required, { purpose: "other" as never })).rejects.toThrow(CHECK);
    await expect(insertMemo(required, { status: "closed" as never })).rejects.toThrow(CHECK);
  });
});

describe("取次メモの決まり", () => {
  it("折り返し希望なら電話番号は必須", async () => {
    const userId = await createUser();
    const recipientId = await createRecipient();
    const required = { recipient_id: recipientId, created_by: userId };
    await expect(insertMemo(required, { purpose: "callback", phone: "" })).rejects.toThrow(CHECK);
    await expect(insertMemo(required, { purpose: "message", phone: "" })).resolves.toEqual(expect.any(Number));
  });

  it("対処済みなら対処済みにした人・日時があり、未対処ならない", async () => {
    const userId = await createUser();
    const recipientId = await createRecipient();
    const required = { recipient_id: recipientId, created_by: userId };
    const at = NOW.toISOString();
    await expect(insertMemo(required, { status: "done", done_by: userId, done_at: at })).resolves.toEqual(
      expect.any(Number),
    );
    await expect(insertMemo(required, { status: "done" })).rejects.toThrow(CHECK);
    await expect(insertMemo(required, { status: "open", done_by: userId, done_at: at })).rejects.toThrow(CHECK);
  });

  it("担当者を紐づけるなら、その担当者の会社も紐づける", async () => {
    const userId = await createUser();
    const recipientId = await createRecipient();
    const required = { recipient_id: recipientId, created_by: userId };
    const companyId = await createCompany(db, COMPANY, userId, NOW);
    const otherCompanyId = await createCompany(db, COMPANY, userId, NOW);
    const contactId = await createContact(db, companyId, CONTACT, userId, NOW);

    await expect(insertMemo(required, { company_id: companyId, contact_id: contactId })).resolves.toEqual(
      expect.any(Number),
    );
    // 会社だけ（担当者 0 人の会社の行から作成）、どちらもなし（未登録の相手）は入る
    await expect(insertMemo(required, { company_id: companyId })).resolves.toEqual(expect.any(Number));
    await expect(insertMemo(required)).resolves.toEqual(expect.any(Number));
    // 担当者だけは入らない。別の会社との組み合わせも入らない
    await expect(insertMemo(required, { contact_id: contactId })).rejects.toThrow(CHECK);
    await expect(insertMemo(required, { company_id: otherCompanyId, contact_id: contactId })).rejects.toThrow(
      FOREIGN_KEY,
    );
  });

  it("存在しない宛先・利用者は入らない（外部キー）", async () => {
    const userId = await createUser();
    const recipientId = await createRecipient();
    await expect(insertMemo({ recipient_id: -1, created_by: userId })).rejects.toThrow(FOREIGN_KEY);
    await expect(insertMemo({ recipient_id: recipientId, created_by: -1 })).rejects.toThrow(FOREIGN_KEY);
  });
});

describe("宛先の更新者・更新日時", () => {
  it("両方あるか、両方ないか", async () => {
    const userId = await createUser();
    const id = await createRecipient();
    const at = NOW.toISOString();
    await expect(
      db.prepare("UPDATE recipients SET updated_by = ?2 WHERE id = ?1").bind(id, userId).run(),
    ).rejects.toThrow(CHECK);
    await expect(db.prepare("UPDATE recipients SET updated_at = ?2 WHERE id = ?1").bind(id, at).run()).rejects.toThrow(
      CHECK,
    );
    await expect(
      db.prepare("UPDATE recipients SET updated_by = ?2, updated_at = ?3 WHERE id = ?1").bind(id, userId, at).run(),
    ).resolves.toBeDefined();
  });
});
