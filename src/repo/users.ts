// 利用者のデータアクセス（docs/db/queries.md 1.1）。
// 利用者を画面から編集・削除することは STEP1 では行わない（仕様書 F-10）。

import type { UserRow } from "./schema.ts";

export type User = Pick<UserRow, "id" | "email" | "name">;

// メールアドレスで利用者を取る（大文字・小文字を区別しない。列の COLLATE NOCASE による）
export async function findUserByEmail(db: D1Database, email: string): Promise<User | null> {
  return db.prepare("SELECT id, email, name FROM users WHERE email = ?1").bind(email).first<User>();
}

// ログイン中の利用者を取る。まだ登録されていなければ、登録してから取る（初回ログイン。F-10）。
// name は 255 文字以内にしてから渡す（users.name の CHECK）。
export async function findOrCreateUser(db: D1Database, email: string, name: string): Promise<User> {
  // ほとんどのリクエストは、この読み取りだけで済む。
  // いきなり INSERT … ON CONFLICT DO NOTHING を流すと、登録済みでも AUTOINCREMENT の連番が進み、
  // すべてのリクエストが書き込みになる
  const found = await findUserByEmail(db, email);
  if (found) return found;

  // 同時に初回ログインが来ても、片方は DO NOTHING になる
  await db
    .prepare("INSERT INTO users (email, name) VALUES (?1, ?2) ON CONFLICT (email) DO NOTHING")
    .bind(email, name)
    .run();
  const created = await findUserByEmail(db, email);
  if (!created) throw new Error("利用者を登録できませんでした。");
  return created;
}
