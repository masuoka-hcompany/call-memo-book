// 会社のデータアクセス（後で D1 に差し替える。D1 と同じく Promise を返す）
// 削除済みの会社は既定で除外する。削除済みも含めて取る関数は名前に IncludingDeleted を付ける。
// 入力チェックは src/domain/company.ts で済ませてから呼ぶ。削除は S-06 を作るときに足す。

import { compareByKana, matchesCompanyKeyword } from "../domain/company.ts";
import { getStore, nextId } from "../mock/store.ts";
import type { Company, Id } from "./types.ts";

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

export async function findCompany(id: Id): Promise<Company | null> {
  const company = getStore().companies.find((c) => c.id === id && !c.deleted);
  return company ? { ...company } : null;
}

export type CompanyValues = Pick<Company, "name" | "kana" | "memo">;

// 登録する。更新者・更新日時を記録する
export async function createCompany(values: CompanyValues, updatedBy: Id, now: Date): Promise<Company> {
  const { companies } = getStore();
  const company: Company = {
    id: nextId(companies),
    ...values,
    deleted: false,
    updatedBy,
    updatedAt: now.toISOString(),
  };
  companies.push(company);
  return { ...company };
}

// 編集する。更新者・更新日時を記録する。削除済み・存在しない会社なら null
export async function updateCompany(id: Id, values: CompanyValues, updatedBy: Id, now: Date): Promise<Company | null> {
  const company = getStore().companies.find((c) => c.id === id && !c.deleted);
  if (!company) return null;
  Object.assign(company, values, { updatedBy, updatedAt: now.toISOString() });
  return { ...company };
}
