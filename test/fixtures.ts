// テスト用のデータを作る関数。テストごとに、必要な分だけ作る（全テストで共有するデータは作らない）。
// メールアドレスは一意の制約があるので、呼ぶたびに違う値にする。

import { env } from "cloudflare:workers";
import type { MemoRow } from "../src/repo/schema.ts";

export const db = env.DB;

// テストで使う「いま」（2026-11-05 14:30 日本時間）
export const NOW = new Date("2026-11-05T05:30:00.000Z");

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${crypto.randomUUID()}@example.com`;
}

export async function createUser(name = "菊地", email = uniqueEmail()): Promise<number> {
  const row = await db
    .prepare("INSERT INTO users (email, name) VALUES (?1, ?2) RETURNING id")
    .bind(email, name)
    .first<{ id: number }>();
  if (!row) throw new Error("createUser failed");
  return row.id;
}

// エンジニアが DB に直接登録した宛先と同じ形（更新者・更新日時なし。docs/db/queries.md 5.1）
export async function createRecipient(displayName = "菊地", email = uniqueEmail("recipient")): Promise<number> {
  const row = await db
    .prepare("INSERT INTO recipients (display_name, email) VALUES (?1, ?2) RETURNING id")
    .bind(displayName, email)
    .first<{ id: number }>();
  if (!row) throw new Error("createRecipient failed");
  return row.id;
}

type MemoValues = Omit<MemoRow, "id" | "deleted_at">;

// 取次メモを 1 件入れる。指定しない列は、制約を満たす値にする
export async function insertMemo(
  required: Pick<MemoValues, "recipient_id" | "created_by">,
  overrides: Partial<MemoValues> = {},
): Promise<number> {
  const at = NOW.toISOString();
  const memo: MemoValues = {
    received_at: "2026-11-05T05:30:00.000Z",
    company_name: "原田電気",
    person_name: "原田",
    phone: "0312345678",
    company_id: null,
    contact_id: null,
    purpose: "callback",
    message: "",
    note: "",
    status: "open",
    done_by: null,
    done_at: null,
    created_at: at,
    updated_by: required.created_by,
    updated_at: at,
    ...required,
    ...overrides,
  };
  const columns = Object.keys(memo);
  const row = await db
    .prepare(`INSERT INTO memos (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")}) RETURNING id`)
    .bind(...Object.values(memo))
    .first<{ id: number }>();
  if (!row) throw new Error("insertMemo failed");
  return row.id;
}
