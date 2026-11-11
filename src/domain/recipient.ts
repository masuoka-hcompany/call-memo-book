// 宛先のルール（仕様書 F-09）：宛先追加・編集（S-11）の入力チェックと、追加できる利用者

import type { FieldErrors } from "./company.ts";
import { requiredMessage } from "./messages.ts";
import { isEmpty, trimSingleLine } from "./text.ts";
import { NAME_MAX, validateText } from "./validation.ts";

// 入力欄の項目名（エラーメッセージの {項目名} と同じ）
export const RECIPIENT_FIELD_LABELS = {
  userId: "利用者",
  displayName: "表示名",
} as const;

type UserLike = { id: number; email: string };
type RecipientLike = { email: string };

// 追加のプルダウンに出す利用者：既に宛先になっている利用者と、削除された宛先の利用者を除く（メールアドレスで照合する）。
// recipients には削除済みの宛先も含めて渡す。
export function selectableUsers<U extends UserLike>(users: U[], recipientsIncludingDeleted: RecipientLike[]): U[] {
  const taken = new Set(recipientsIncludingDeleted.map((r) => r.email));
  return users.filter((u) => !taken.has(u.email));
}

export type NewRecipientValidation<U> = { ok: true; user: U } | { ok: false; errors: FieldErrors<"userId"> };

// 追加：利用者は必須。プルダウンにない利用者（既に宛先になっている利用者など）が送られたときも、選ばれていないとみなす
// （仮。docs/questions.md Q-M25）
export function validateNewRecipient<U extends UserLike>(userId: string, selectable: U[]): NewRecipientValidation<U> {
  const user = isEmpty(userId) ? undefined : selectable.find((u) => String(u.id) === userId.trim());
  if (!user) return { ok: false, errors: { userId: [requiredMessage(RECIPIENT_FIELD_LABELS.userId)] } };
  return { ok: true, user };
}

export type RecipientNameValidation =
  | { ok: true; displayName: string }
  | { ok: false; displayName: string; errors: FieldErrors<"displayName"> };

// 編集：表示名は必須・255文字以内。前後の空白を削ってから確かめ、削った値を返す（Q-M11）
export function validateRecipientName(input: string): RecipientNameValidation {
  const displayName = trimSingleLine(input);
  const errors = validateText(displayName, {
    label: RECIPIENT_FIELD_LABELS.displayName,
    required: true,
    max: NAME_MAX,
  });
  return errors.length === 0 ? { ok: true, displayName } : { ok: false, displayName, errors: { displayName: errors } };
}
