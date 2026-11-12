// S-01 相手検索の本文（見出しは AppLayout が出す）
// 仕様：docs/screens/S-01.md、取次可否の表示：docs/design.md 5章

import type { ResolvedSetting, SettingValue } from "../domain/setting.ts";
import { displayName } from "../domain/text.ts";
import type { Party } from "../repo/search.ts";
import type { Recipient } from "../repo/types.ts";
import { PendingBadge } from "./components.tsx";
import { LABELS } from "./labels.ts";
import { Breakdown, Verdict } from "./verdict.tsx";

export const SEARCH_LABELS = {
  searchField: "検索欄",
  companyName: "会社名",
  contactName: "担当者名",
  phone: "電話番号",
  notFound: "該当する相手が見つかりません",
  createMemo: "取次メモを作成",
  settings: "宛先ごとの取次可否",
} as const;

// 選んだ相手の、宛先ごとの取次可否
export type PartySetting = {
  recipient: Recipient;
  company: SettingValue;
  // 会社だけの行を選んだときは null（担当者の取次可否は表示しない）
  contact: SettingValue | null;
  resolved: ResolvedSetting;
};

type Props = {
  keyword: string;
  // 検索したか（検索欄が空のまま検索したときは false。結果も0件の表示も出さない）
  searched: boolean;
  rows: Party[];
  // 選んでいる行（rows の中の1つ）
  selected: Party | null;
  settings: PartySetting[];
  // 「取次メモを作成」の行き先（S-04。選んだ相手があれば、その相手を渡す）
  createMemoHref: string;
};

// 行を選ぶ URL（検索語を残す）
export function selectHref(keyword: string, row: Party): string {
  const q = `q=${encodeURIComponent(keyword)}`;
  return row.contact ? `/?${q}&contact=${row.contact.id}` : `/?${q}&company=${row.company.id}`;
}

function isSelected(row: Party, selected: Party | null): boolean {
  if (!selected) return false;
  return selected.company.id === row.company.id && (selected.contact?.id ?? null) === (row.contact?.id ?? null);
}

export function SearchPage({ keyword, searched, rows, selected, settings, createMemoHref }: Props) {
  const L = SEARCH_LABELS;
  return (
    <>
      <p class="mb-4">
        <PendingBadge id="Q-M10" label="画面名（相手検索／相手検索（トップ画面））" />
      </p>
      <div class="mb-6 flex items-start justify-between gap-6">
        <div class="flex-1">
          <search>
            <form method="get" action="/" novalidate class="flex max-w-2xl gap-2">
              <input
                type="search"
                name="q"
                value={keyword}
                class="input input-lg w-full"
                aria-label={L.searchField}
                autofocus
              />
              <button type="submit" class="btn btn-lg btn-plain">
                {LABELS.search}
              </button>
            </form>
          </search>
          <p class="mt-2">
            <PendingBadge id="Q-M26" label="空白だけ・前後に空白を入れて検索したとき" />
          </p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <a href={createMemoHref} class="btn btn-primary">
            {L.createMemo}
          </a>
          <PendingBadge id="Q-M27" label="「取次メモを作成」を出す場面" />
        </div>
      </div>

      {searched && rows.length === 0 && (
        <p class="mb-6" data-testid="not-found">
          {L.notFound}
        </p>
      )}

      {rows.length > 0 && (
        <div class="grid grid-cols-1 gap-10 xl:grid-cols-2">
          <table class="w-full self-start" data-table="results">
            <thead>
              <tr class="border-b border-base-300 text-left text-sm text-secondary">
                <th class="px-3 py-2 font-normal">{L.companyName}</th>
                <th class="px-3 py-2 font-normal">{L.contactName}</th>
                <th class="px-3 py-2 font-normal">{L.phone}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const current = isSelected(row, selected);
                return (
                  <tr class={`${current ? "row-selected " : ""}border-b border-base-300`}>
                    <td class="px-3 py-2">
                      <a href={selectHref(keyword, row)} class="link" {...(current ? { "aria-current": "true" } : {})}>
                        {displayName(row.company.name, row.company.kana)}
                      </a>
                    </td>
                    <td class="px-3 py-2">{row.contact ? displayName(row.contact.name, row.contact.kana) : ""}</td>
                    <td class="tabular px-3 py-2">{row.contact?.phone ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {selected && (
            <section aria-labelledby="settings-heading" data-section="settings">
              <h2 id="settings-heading" class="mb-3 border-b-2 border-base-content pb-1 text-lg font-bold">
                {L.settings}
              </h2>
              <p class="mb-2 flex flex-wrap gap-2">
                <PendingBadge id="Q-M01" label="採用値の強調（判定列）" />
                <PendingBadge id="Q-M02" label="採用値が「未設定」のときの対応" />
              </p>
              <table class="w-full" data-table="settings">
                <tbody>
                  {settings.map((s) => (
                    <tr class="border-b border-base-300" data-recipient-id={String(s.recipient.id)}>
                      <th
                        scope="row"
                        class="w-px whitespace-nowrap py-2 pr-6 text-left font-bold"
                        data-field="recipient"
                      >
                        {s.recipient.displayName}
                      </th>
                      <td class="w-px whitespace-nowrap py-2 pr-6" data-field="verdict">
                        <Verdict value={s.resolved.value} />
                      </td>
                      <td class="py-2" data-field="breakdown">
                        <Breakdown contact={s.contact} company={s.company} resolved={s.resolved} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </>
  );
}
