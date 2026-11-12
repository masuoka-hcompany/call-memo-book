// 宛先のデータアクセス（後で D1 に差し替える。D1 と同じく Promise を返す）
// 削除済みの宛先は既定で除外する。削除済みも含めて取る関数は名前に IncludingDeleted を付ける。
// 入力チェック・追加できる利用者の判定は src/domain/recipient.ts で済ませてから呼ぶ。

import { getStore, nextId } from "../mock/store.ts";
import type { Id, Recipient } from "./types.ts";

export async function findRecipient(id: Id): Promise<Recipient | null> {
  const recipient = getStore().recipients.find((r) => r.id === id && !r.deleted);
  return recipient ? { ...recipient } : null;
}

// 追加する（表示名は利用者の名前、メールアドレスは利用者のもの）。更新者・更新日時を記録する
export async function createRecipient(
  values: Pick<Recipient, "displayName" | "email">,
  updatedBy: Id,
  now: Date,
): Promise<Recipient> {
  const { recipients } = getStore();
  const recipient: Recipient = {
    id: nextId(recipients),
    ...values,
    deleted: false,
    updatedBy,
    updatedAt: now.toISOString(),
  };
  recipients.push(recipient);
  return { ...recipient };
}

// 表示名を編集する（メールアドレスは変えない）。更新者・更新日時を記録する。削除済み・存在しない宛先なら null
export async function updateRecipientName(
  id: Id,
  displayName: string,
  updatedBy: Id,
  now: Date,
): Promise<Recipient | null> {
  const recipient = getStore().recipients.find((r) => r.id === id && !r.deleted);
  if (!recipient) return null;
  Object.assign(recipient, { displayName, updatedBy, updatedAt: now.toISOString() });
  return { ...recipient };
}

// 削除されていない宛先。登録順（ID の小さい順。仮。docs/questions.md Q-M23）
export async function listRecipients(): Promise<Recipient[]> {
  return getStore()
    .recipients.filter((r) => !r.deleted)
    .sort((a, b) => a.id - b.id)
    .map((r) => ({ ...r }));
}

export async function listRecipientsIncludingDeleted(): Promise<Recipient[]> {
  return getStore().recipients.map((r) => ({ ...r }));
}

// 削除する（論理削除）。データは残し、削除フラグを立てて更新者・更新日時を記録する。
// 宛先の取次メモ・取次可否はそのまま残す。削除済み・存在しない宛先なら false
export async function deleteRecipient(id: Id, updatedBy: Id, now: Date): Promise<boolean> {
  const recipient = getStore().recipients.find((r) => r.id === id && !r.deleted);
  if (!recipient) return false;
  Object.assign(recipient, { deleted: true, updatedBy, updatedAt: now.toISOString() });
  return true;
}
