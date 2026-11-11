// 会社のデータアクセス（後で D1 に差し替える。D1 と同じく Promise を返す）
// 削除済みの会社は既定で除外する。削除済みも含めて取る関数は名前に IncludingDeleted を付ける。
// 登録・編集・削除は S-06・S-07 を作るときに足す。

import { compareByKana, matchesCompanyKeyword } from "../domain/company.ts";
import { getStore } from "../mock/store.ts";
import type { Company } from "./types.ts";

export type CompanyListItem = Company & {
  // 削除されていない担当者の数
  contactCount: number;
};

// 会社一覧（S-05）：会社名・よみがなに部分一致する会社を、よみがな順に返す。keyword が空ならすべて
export async function listCompanies(keyword = ""): Promise<CompanyListItem[]> {
  const { companies, contacts } = getStore();
  return companies
    .filter((c) => !c.deleted && matchesCompanyKeyword(c, keyword))
    .sort(compareByKana)
    .map((c) => ({
      ...c,
      contactCount: contacts.filter((p) => p.companyId === c.id && !p.deleted).length,
    }));
}
