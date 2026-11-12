// 相手の検索（S-01）のデータアクセス（後で D1 に差し替える。D1 と同じく Promise を返す）
// 一致のルールは src/domain/search.ts。削除された会社・担当者は返さない。

import { searchParties as matchParties, type PartyRow } from "../domain/search.ts";
import { getStore } from "../mock/store.ts";
import type { Company, Contact } from "./types.ts";

export type Party = PartyRow<Company, Contact>;

export async function searchParties(keyword: string): Promise<Party[]> {
  const { companies, contacts } = getStore();
  return matchParties(
    companies.map((c) => ({ ...c })),
    contacts.map((p) => ({ ...p })),
    keyword,
  );
}
