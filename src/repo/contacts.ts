// 担当者のデータアクセス（docs/db/queries.md 3.2）。
// 削除済みの担当者は既定で除外する。入力チェックは src/domain/ で済ませてから呼ぶ。

import type { ContactRow } from "./schema.ts";

export type ContactValues = Pick<ContactRow, "name" | "kana" | "phone" | "memo">;

// 登録する。会社が削除済み・存在しないときは登録せず、null を返す
// （会社の削除と同時に来たときに、削除済みの会社に担当者が増えないように、SQL の中で確かめる）
export async function createContact(
  db: D1Database,
  companyId: number,
  values: ContactValues,
  updatedBy: number,
  now: Date,
): Promise<number | null> {
  const row = await db
    .prepare(
      `INSERT INTO contacts (company_id, name, kana, phone, memo, created_at, updated_by, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?6
       WHERE EXISTS (SELECT 1 FROM companies WHERE id = ?1 AND deleted_at IS NULL)
       RETURNING id`,
    )
    .bind(companyId, values.name, values.kana, values.phone, values.memo, now.toISOString(), updatedBy)
    .first<{ id: number }>();
  return row?.id ?? null;
}

// 削除する（論理削除）。担当者単位の取次可否・紐づく取次メモはそのまま残す。
// 削除済み・存在しない担当者なら false
export async function deleteContact(db: D1Database, id: number, updatedBy: number, now: Date): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE contacts SET deleted_at = ?2, updated_by = ?3, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL",
    )
    .bind(id, now.toISOString(), updatedBy)
    .run();
  return result.meta.changes > 0;
}
