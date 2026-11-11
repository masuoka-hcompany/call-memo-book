// 担当者のデータアクセス（後で D1 に差し替える。D1 と同じく Promise を返す）
// 削除済みの担当者は既定で除外する。登録・編集・削除は S-08・S-09 を作るときに足す。

import { getStore } from "../mock/store.ts";
import type { Contact, Id } from "./types.ts";

// 会社の担当者（削除されていないもの）。登録順（ID の小さい順。仮。docs/questions.md Q-M18）
export async function listContactsByCompany(companyId: Id): Promise<Contact[]> {
  return getStore()
    .contacts.filter((p) => p.companyId === companyId && !p.deleted)
    .sort((a, b) => a.id - b.id)
    .map((p) => ({ ...p }));
}
