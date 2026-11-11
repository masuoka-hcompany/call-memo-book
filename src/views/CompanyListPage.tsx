// S-05 会社一覧の本文（見出し・完了メッセージは AppLayout が出す）
// 仕様：docs/screens/S-05.md

import { displayName } from "../domain/text.ts";
import type { CompanyListItem } from "../repo/companies.ts";
import { PendingBadge } from "./components.tsx";
import { LABELS } from "./labels.ts";

export const COMPANY_LIST_LABELS = {
  searchField: "検索欄",
  create: "新規登録",
  name: "会社名",
  kana: "よみがな",
  contactCount: "担当者数",
} as const;

export function CompanyListPage({ keyword, companies }: { keyword: string; companies: CompanyListItem[] }) {
  const L = COMPANY_LIST_LABELS;
  return (
    <>
      <div class="mb-6 flex items-start justify-between gap-6">
        <div class="flex-1">
          <search>
            <form method="get" action="/companies" novalidate class="flex max-w-xl gap-2">
              <input type="search" name="q" value={keyword} class="input w-full" aria-label={L.searchField} />
              <button type="submit" class="btn btn-plain">
                {LABELS.search}
              </button>
            </form>
          </search>
          <p class="mt-2">
            <PendingBadge id="Q-M12" label="検索欄を空のまま検索したとき" />
          </p>
        </div>
        <a href="/companies/new" class="btn btn-primary">
          {L.create}
        </a>
      </div>

      <p class="mb-2">
        <PendingBadge id="Q-M14" label="よみがな順の細則" />
      </p>
      {companies.length === 0 ? (
        <p>
          <PendingBadge id="Q-M13" label="0件のときの表示" />
        </p>
      ) : (
        <table class="w-full max-w-4xl">
          <thead>
            <tr class="border-b border-base-300 text-left text-sm text-secondary">
              <th class="px-3 py-2 font-normal">{L.name}</th>
              <th class="px-3 py-2 font-normal">{L.kana}</th>
              <th class="px-3 py-2 text-right font-normal">{L.contactCount}</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr class="border-b border-base-300" data-company-id={String(company.id)}>
                <td class="px-3 py-2">
                  <a href={`/companies/${company.id}`} class="link">
                    {displayName(company.name, company.kana)}
                  </a>
                </td>
                <td class="px-3 py-2">{company.kana}</td>
                <td class="tabular px-3 py-2 text-right">{company.contactCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
