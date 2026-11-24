// テーブルの列と型（migrations/ と同じ内容を、TypeScript で持つ）。
// 行の型（UserRow など）はここから作る。SQL の結果に型を付けるときは、この型を使う。
//
// D1 の結果の型（.all<T>() の T）は、実行時には確かめられない。そのため、この定義が実際の DB と
// 合っていることを test/db/schema.test.ts が確かめる（列の名前・型・NULL を許すか・区分の値）。
// マイグレーションで列を変えたら、ここも直す（直し忘れるとテストが落ちる）。

import { MEMO_PURPOSES, MEMO_STATUSES, SETTING_VALUES } from "../domain/codes.ts";

export type Column = {
  type: "INTEGER" | "TEXT";
  nullable: boolean;
  // 区分の列：入れられる値（DB の CHECK … IN (…) と同じ）
  values?: readonly string[];
};

const integer = { type: "INTEGER", nullable: false } as const;
const text = { type: "TEXT", nullable: false } as const;
const nullableInteger = { type: "INTEGER", nullable: true } as const;
const nullableText = { type: "TEXT", nullable: true } as const;

function oneOf<const V extends readonly string[]>(values: V) {
  return { type: "TEXT", nullable: false, values } as const;
}

// 日時は TEXT（UTC。2026-11-05T05:30:00.000Z の形。docs/db/README.md 1.2）
export const SCHEMA = {
  users: {
    id: integer,
    email: text,
    name: text,
    created_at: text,
  },
  recipients: {
    id: integer,
    display_name: text,
    email: text,
    created_at: text,
    // エンジニアが DB に直接登録した宛先は、更新者・更新日時がない
    updated_by: nullableInteger,
    updated_at: nullableText,
    deleted_at: nullableText,
  },
  companies: {
    id: integer,
    name: text,
    kana: text,
    phone: text,
    memo: text,
    created_at: text,
    updated_by: integer,
    updated_at: text,
    deleted_at: nullableText,
  },
  contacts: {
    id: integer,
    company_id: integer,
    name: text,
    kana: text,
    phone: text,
    memo: text,
    created_at: text,
    updated_by: integer,
    updated_at: text,
    deleted_at: nullableText,
  },
  company_settings: {
    company_id: integer,
    recipient_id: integer,
    value: oneOf(SETTING_VALUES),
    created_at: text,
    updated_by: integer,
    updated_at: text,
  },
  contact_settings: {
    contact_id: integer,
    recipient_id: integer,
    value: oneOf(SETTING_VALUES),
    created_at: text,
    updated_by: integer,
    updated_at: text,
  },
  memos: {
    id: integer,
    recipient_id: integer,
    received_at: text,
    company_name: text,
    person_name: text,
    phone: text,
    company_id: nullableInteger,
    contact_id: nullableInteger,
    purpose: oneOf(MEMO_PURPOSES),
    message: text,
    note: text,
    status: oneOf(MEMO_STATUSES),
    done_by: nullableInteger,
    done_at: nullableText,
    created_by: integer,
    created_at: text,
    updated_by: integer,
    updated_at: text,
    deleted_at: nullableText,
  },
} as const satisfies Record<string, Record<string, Column>>;

export type TableName = keyof typeof SCHEMA;

type ValueOf<C extends Column> = C extends { values: readonly (infer V)[] }
  ? V
  : C["type"] extends "INTEGER"
    ? number
    : string;

// テーブルの 1 行の型（列の名前は DB と同じ snake_case）
export type RowOf<T extends TableName> = {
  -readonly [K in keyof (typeof SCHEMA)[T]]: (typeof SCHEMA)[T][K] extends infer C extends Column
    ? C["nullable"] extends true
      ? ValueOf<C> | null
      : ValueOf<C>
    : never;
};

export type UserRow = RowOf<"users">;
export type RecipientRow = RowOf<"recipients">;
export type CompanyRow = RowOf<"companies">;
export type ContactRow = RowOf<"contacts">;
export type CompanySettingRow = RowOf<"company_settings">;
export type ContactSettingRow = RowOf<"contact_settings">;
export type MemoRow = RowOf<"memos">;
