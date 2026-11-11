// 取次メモのルール（仕様書 F-02・F-04・8.2）：区分と、取次メモ作成・編集（S-04）の入力チェック

import type { FieldErrors } from "./company.ts";
import { parseJstDateTimeLocal } from "./datetime.ts";
import { CALLBACK_PHONE_REQUIRED_MESSAGE, PHONE_LABEL, requiredMessage } from "./messages.ts";
import { isEmpty, trimSingleLine } from "./text.ts";
import { LONG_TEXT_MAX, NAME_MAX, validatePhone, validateText } from "./validation.ts";

export const MEMO_PURPOSES = ["callback", "notify", "message"] as const;
export type MemoPurpose = (typeof MEMO_PURPOSES)[number];

export const MEMO_PURPOSE_LABELS: Record<MemoPurpose, string> = {
  callback: "折り返し希望",
  notify: "連絡があったことをお伝え希望",
  message: "伝言希望",
};

export function isMemoPurpose(value: unknown): value is MemoPurpose {
  return typeof value === "string" && (MEMO_PURPOSES as readonly string[]).includes(value);
}

export const MEMO_STATUSES = ["open", "done"] as const;
export type MemoStatus = (typeof MEMO_STATUSES)[number];

export const MEMO_STATUS_LABELS: Record<MemoStatus, string> = {
  open: "未対処",
  done: "対処済み",
};

// ---------- S-04 取次メモ作成・編集 ----------

// 入力欄の項目名（エラーメッセージの {項目名} と同じ。仕様書 7.1・F-02）
export const MEMO_FIELD_LABELS = {
  recipientId: "宛先",
  receivedAt: "受電日時",
  companyName: "会社名",
  personName: "氏名",
  phone: PHONE_LABEL,
  purpose: "用件",
  message: "伝言",
  note: "メモ",
} as const;

export type MemoField = keyof typeof MEMO_FIELD_LABELS;
// 画面から送られた値（すべて文字列。受電日時は <input type="datetime-local"> の日本時間「2026-11-05T14:30」）
export type MemoInput = Record<MemoField, string>;

// 保存する値
export type MemoValues = {
  recipientId: number;
  receivedAt: Date;
  companyName: string;
  personName: string;
  phone: string;
  purpose: MemoPurpose;
  message: string;
  note: string;
};

export type MemoValidation =
  | { ok: true; values: MemoValues }
  | { ok: false; input: MemoInput; errors: FieldErrors<MemoField> };

// 取次メモの入力を確かめる。recipientIds は選べる宛先（削除されていない宛先）の ID。
// - 宛先・用件：選べる値以外（未選択・削除された宛先など）は、選ばれていないとみなし必須のエラー（仮。docs/questions.md Q-M28）
// - 受電日時：空・形式が違う・実在しない日時は必須のエラー（仮。Q-M28）
// - 会社名・氏名・電話番号は前後の空白を削ってから確かめる。伝言・メモは削らない（Q-M11）
// - 電話番号：用件が「折り返し希望」なら必須（「折り返し希望の場合、電話番号は必須です」）、それ以外は任意
export function validateMemoInput(input: MemoInput, recipientIds: number[]): MemoValidation {
  const L = MEMO_FIELD_LABELS;
  const trimmed: MemoInput = {
    ...input,
    companyName: trimSingleLine(input.companyName),
    personName: trimSingleLine(input.personName),
    phone: trimSingleLine(input.phone),
  };
  const recipientId = recipientIds.find((id) => String(id) === input.recipientId.trim());
  const receivedAt = isEmpty(input.receivedAt) ? null : parseJstDateTimeLocal(input.receivedAt.trim());
  const purpose = isMemoPurpose(input.purpose) ? input.purpose : undefined;

  const all: FieldErrors<MemoField> = {
    recipientId: recipientId === undefined ? [requiredMessage(L.recipientId)] : [],
    receivedAt: receivedAt === null ? [requiredMessage(L.receivedAt)] : [],
    companyName: validateText(trimmed.companyName, { label: L.companyName, required: true, max: NAME_MAX }),
    personName: validateText(trimmed.personName, { label: L.personName, max: NAME_MAX }),
    phone: validatePhone(trimmed.phone, purpose === "callback" ? CALLBACK_PHONE_REQUIRED_MESSAGE : null),
    purpose: purpose === undefined ? [requiredMessage(L.purpose)] : [],
    message: validateText(input.message, { label: L.message, max: LONG_TEXT_MAX }),
    note: validateText(input.note, { label: L.note, max: LONG_TEXT_MAX }),
  };
  const errors = Object.fromEntries(
    Object.entries(all).filter(([, messages]) => messages && messages.length > 0),
  ) as FieldErrors<MemoField>;
  if (Object.keys(errors).length > 0 || recipientId === undefined || receivedAt === null || purpose === undefined) {
    return { ok: false, input, errors };
  }
  return {
    ok: true,
    values: {
      recipientId,
      receivedAt,
      companyName: trimmed.companyName,
      personName: trimmed.personName,
      phone: trimmed.phone,
      purpose,
      message: input.message,
      note: input.note,
    },
  };
}

// ---------- S-03 対処済み・未対処の切り替え（F-05） ----------

export type MemoStatusFields = { status: MemoStatus; doneBy: number | null; doneAt: string | null };

// 状態を切り替えたあとの値。
// - 対処済みにする：対処済みにした人と日時を記録する。未対処に戻す：消す（F-05・AC-53・AC-54）
// - 既にその状態なら何も変えない（対処済みにした人・日時を上書きしない。仮。docs/questions.md Q-M33）
// - 更新者・更新日時は変えない（F-05 は「対処済みにした人と日時」の記録だけを定める。仮。Q-M33）
export function changeMemoStatus(current: MemoStatusFields, to: MemoStatus, by: number, now: Date): MemoStatusFields {
  if (current.status === to) return { ...current };
  return to === "done"
    ? { status: "done", doneBy: by, doneAt: now.toISOString() }
    : { status: "open", doneBy: null, doneAt: null };
}
