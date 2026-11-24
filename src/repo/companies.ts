// 会社のデータアクセス（docs/db/queries.md 2.6・2.7・3.1・3.3）。
// 削除済みの会社は既定で除外する。入力チェックは src/domain/ で済ませてから呼ぶ。

import type { CompanyRow } from "./schema.ts";

export type CompanyValues = Pick<CompanyRow, "name" | "kana" | "phone" | "memo">;

export type CompanyListItem = Pick<CompanyRow, "id" | "name" | "kana"> & {
  // 削除されていない担当者の数
  contact_count: number;
};

export type CompanyDetail = CompanyRow & { updated_by_name: string };

// 会社一覧（S-05）：会社名・よみがなに部分一致する会社を、よみがな順（同じなら登録順）で返す。
// keyword が空ならすべて。部分一致は入力どおりに比べる（instr。LIKE は英字の大文字と小文字を区別しない）
export async function listCompanies(db: D1Database, keyword = ""): Promise<CompanyListItem[]> {
  // 条件は、指定されたものだけを WHERE に足す（(?1 = '' OR …) の形にしない）
  const filter = keyword === "" ? "" : "AND (instr(c.name, ?1) > 0 OR instr(c.kana, ?1) > 0)";
  const statement = db.prepare(
    `SELECT c.id, c.name, c.kana,
            (SELECT count(*) FROM contacts p WHERE p.company_id = c.id AND p.deleted_at IS NULL) AS contact_count
     FROM companies c
     WHERE c.deleted_at IS NULL ${filter}
     ORDER BY c.kana, c.id`,
  );
  const { results } = await (keyword === "" ? statement : statement.bind(keyword)).all<CompanyListItem>();
  return results;
}

// 会社の情報と、更新者の名前（S-06）。削除済み・存在しない会社なら null
export async function findCompany(db: D1Database, id: number): Promise<CompanyDetail | null> {
  return db
    .prepare(
      `SELECT c.*, u.name AS updated_by_name
       FROM companies c JOIN users u ON u.id = c.updated_by
       WHERE c.id = ?1 AND c.deleted_at IS NULL`,
    )
    .bind(id)
    .first<CompanyDetail>();
}

// 登録する。更新者・更新日時を記録する。登録した会社の ID を返す
export async function createCompany(
  db: D1Database,
  values: CompanyValues,
  updatedBy: number,
  now: Date,
): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO companies (name, kana, phone, memo, created_at, updated_by, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?5)
       RETURNING id`,
    )
    .bind(values.name, values.kana, values.phone, values.memo, now.toISOString(), updatedBy)
    .first<{ id: number }>();
  if (!row) throw new Error("会社を登録できませんでした。");
  return row.id;
}

// 編集する。更新者・更新日時を記録する。削除済み・存在しない会社なら false
export async function updateCompany(
  db: D1Database,
  id: number,
  values: CompanyValues,
  updatedBy: number,
  now: Date,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE companies SET name = ?2, kana = ?3, phone = ?4, memo = ?5, updated_by = ?6, updated_at = ?7
       WHERE id = ?1 AND deleted_at IS NULL`,
    )
    .bind(id, values.name, values.kana, values.phone, values.memo, updatedBy, now.toISOString())
    .run();
  return result.meta.changes > 0;
}

// 削除の時刻をずらしてやり直す回数の上限
const DELETE_MAX_ATTEMPTS = 5;

// 削除する（論理削除）。所属する担当者にも、会社と同じ削除日時を入れる。紐づく取次メモ・取次可否はそのまま残す。
// 削除済み・存在しない会社なら false。
//
// 復旧のときに「会社と一緒に削除された担当者」を削除日時で見分けるので、同じ会社に、同じ削除日時で
// 個別に削除された担当者が既にいるときは、時刻を 1 ミリ秒進めてやり直す（docs/db/queries.md 3.3）。
export async function deleteCompany(db: D1Database, id: number, updatedBy: number, now: Date): Promise<boolean> {
  for (let attempt = 0; attempt < DELETE_MAX_ATTEMPTS; attempt++) {
    const at = new Date(now.getTime() + attempt).toISOString();
    // 2 つの文をまとめて反映する（batch の中の文は、他の書き込みに割り込まれずに順に流れる）
    const [company] = await db.batch([
      // 1. 会社：同じ会社に、削除日時が同じ担当者が既にいたら 0 行
      db
        .prepare(
          `UPDATE companies SET deleted_at = ?2, updated_by = ?3, updated_at = ?2
           WHERE id = ?1 AND deleted_at IS NULL
             AND NOT EXISTS (SELECT 1 FROM contacts WHERE company_id = ?1 AND deleted_at = ?2)`,
        )
        .bind(id, at, updatedBy),
      // 2. 担当者：1. で会社がこの時刻で削除されたときだけ
      db
        .prepare(
          `UPDATE contacts SET deleted_at = ?2, updated_by = ?3, updated_at = ?2
           WHERE company_id = ?1 AND deleted_at IS NULL
             AND EXISTS (SELECT 1 FROM companies WHERE id = ?1 AND deleted_at = ?2)`,
        )
        .bind(id, at, updatedBy),
    ]);
    if (company && company.meta.changes > 0) return true;

    // 0 行だった理由を見分ける：削除済み・存在しないなら終わり。削除されていないなら、時刻が重なっている
    const current = await db
      .prepare("SELECT deleted_at FROM companies WHERE id = ?1")
      .bind(id)
      .first<Pick<CompanyRow, "deleted_at">>();
    if (!current || current.deleted_at !== null) return false;
  }
  throw new Error("会社を削除できませんでした（担当者の削除日時との重なりが続きました）。");
}
