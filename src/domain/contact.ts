// 担当者のルール（仕様書 F-07）：担当者登録・編集（S-09）の入力チェック

import type { FieldErrors } from "./company.ts";
import { PHONE_LABEL, requiredMessage } from "./messages.ts";
import { trimSingleLine } from "./text.ts";
import { LONG_TEXT_MAX, NAME_MAX, validatePhone, validateText } from "./validation.ts";

// 入力欄の項目名（エラーメッセージの {項目名} と同じ）
export const CONTACT_FIELD_LABELS = {
  name: "担当者名",
  kana: "担当者名のよみがな",
  phone: PHONE_LABEL,
  memo: "メモ",
} as const;

export type ContactField = keyof typeof CONTACT_FIELD_LABELS;
export type ContactInput = Record<ContactField, string>;

export type ContactValidation =
  | { ok: true; values: ContactInput }
  | { ok: false; values: ContactInput; errors: FieldErrors<ContactField> };

// 担当者の入力を確かめる。担当者名・よみがな・電話番号は前後の空白を削ってから確かめ、削った値を返す。
// メモは入力どおり（Q-M11）。電話番号は必須・半角数字のみ・15桁以内（全角数字やハイフンは変換しない）。
export function validateContactInput(input: ContactInput): ContactValidation {
  const values: ContactInput = {
    name: trimSingleLine(input.name),
    kana: trimSingleLine(input.kana),
    phone: trimSingleLine(input.phone),
    memo: input.memo,
  };
  const L = CONTACT_FIELD_LABELS;
  const all: FieldErrors<ContactField> = {
    name: validateText(values.name, { label: L.name, max: NAME_MAX }),
    kana: validateText(values.kana, { label: L.kana, required: true, max: NAME_MAX, kana: true }),
    phone: validatePhone(values.phone, requiredMessage(L.phone)),
    memo: validateText(values.memo, { label: L.memo, max: LONG_TEXT_MAX }),
  };
  const errors = Object.fromEntries(
    Object.entries(all).filter(([, messages]) => messages && messages.length > 0),
  ) as FieldErrors<ContactField>;
  return Object.keys(errors).length === 0 ? { ok: true, values } : { ok: false, values, errors };
}
