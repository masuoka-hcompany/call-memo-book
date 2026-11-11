// 担当者のデータアクセス（後で D1 に差し替える。D1 と同じく Promise を返す）
// 削除済みの担当者は既定で除外する。削除は S-08 を作るときに足す。
// 入力チェックは src/domain/contact.ts で済ませてから呼ぶ。

import { getStore, nextId } from "../mock/store.ts";
import type { Contact, Id } from "./types.ts";

// 会社の担当者（削除されていないもの）。登録順（ID の小さい順。仮。docs/questions.md Q-M18）
export async function listContactsByCompany(companyId: Id): Promise<Contact[]> {
  return getStore()
    .contacts.filter((p) => p.companyId === companyId && !p.deleted)
    .sort((a, b) => a.id - b.id)
    .map((p) => ({ ...p }));
}

export async function findContact(id: Id): Promise<Contact | null> {
  const contact = getStore().contacts.find((p) => p.id === id && !p.deleted);
  return contact ? { ...contact } : null;
}

export type ContactValues = Pick<Contact, "name" | "kana" | "phone" | "memo">;

// 会社に担当者を登録する。更新者・更新日時を記録する（会社が削除されていないことは呼ぶ側で確かめる）
export async function createContact(companyId: Id, values: ContactValues, updatedBy: Id, now: Date): Promise<Contact> {
  const { contacts } = getStore();
  const contact: Contact = {
    id: nextId(contacts),
    companyId,
    ...values,
    deleted: false,
    updatedBy,
    updatedAt: now.toISOString(),
  };
  contacts.push(contact);
  return { ...contact };
}

// 編集する。所属する会社は変えない。更新者・更新日時を記録する。削除済み・存在しない担当者なら null
export async function updateContact(id: Id, values: ContactValues, updatedBy: Id, now: Date): Promise<Contact | null> {
  const contact = getStore().contacts.find((p) => p.id === id && !p.deleted);
  if (!contact) return null;
  Object.assign(contact, values, { updatedBy, updatedAt: now.toISOString() });
  return { ...contact };
}
