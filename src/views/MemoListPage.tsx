// S-02 取次メモ一覧の本文（見出し・完了メッセージは AppLayout が出す）
// 仕様：docs/screens/S-02.md

import { formatJst } from "../domain/datetime.ts";
import { MEMO_PURPOSE_LABELS, MEMO_STATUS_LABELS, MEMO_STATUSES } from "../domain/memo.ts";
import { type MemoListQuery, type MemoPage, RECIPIENT_FILTER_ME } from "../domain/memo-list.ts";
import type { Memo, Recipient, User } from "../repo/types.ts";
import { MemoStatusLabel, PendingBadge } from "./components.tsx";
import { LABELS } from "./labels.ts";

// 画面の文言（仕様書 7.1・F-03・7.3）
export const MEMO_LIST_LABELS = {
  recipient: "宛先",
  me: "自分宛て",
  status: "状態",
  all: "すべて",
  period: "受電日時の期間",
  keyword: "キーワード",
  createMemo: "取次メモを作成",
  receivedAt: "受電日時",
  companyName: "会社名",
  personName: "氏名",
  purpose: "用件",
  createdBy: "作成者",
  noMemos: "取次メモはまだありません",
  noMatch: "条件に一致する取次メモはありません",
} as const;

type Props = {
  query: MemoListQuery;
  // 宛先の絞り込みの選択肢（削除されていない宛先）
  recipientOptions: Recipient[];
  // 一覧の宛先名に使う（削除された宛先の取次メモも残るため、削除済みを含む）
  allRecipients: Recipient[];
  users: User[];
  // 削除されていない取次メモが1件もないか
  noMemos: boolean;
  result: MemoPage<Memo>;
};

// 絞り込み条件を残したまま、ページを変える URL
export function pageHref(query: MemoListQuery, page: number): string {
  const params = new URLSearchParams();
  for (const key of ["recipient", "status", "from", "to", "q"] as const) {
    if (query[key] !== "") params.set(key, query[key]);
  }
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s === "" ? "/memos" : `/memos?${s}`;
}

function nameOf<T extends { id: number }>(list: T[], id: number, pick: (t: T) => string): string {
  const found = list.find((t) => t.id === id);
  return found ? pick(found) : "";
}

export function MemoListPage({ query, recipientOptions, allRecipients, users, noMemos, result }: Props) {
  const L = MEMO_LIST_LABELS;
  return (
    <>
      <div class="mb-6 flex items-start justify-between gap-6">
        <div class="flex-1">
          <search>
            <form method="get" action="/memos" novalidate class="flex flex-wrap items-end gap-4">
              <div>
                <label for="filter-recipient" class="mb-1 block text-sm">
                  {L.recipient}
                </label>
                <select id="filter-recipient" name="recipient" class="select w-40">
                  <option value="" selected={query.recipient === ""}>
                    {L.all}
                  </option>
                  <option value={RECIPIENT_FILTER_ME} selected={query.recipient === RECIPIENT_FILTER_ME}>
                    {L.me}
                  </option>
                  {recipientOptions.map((r) => (
                    <option value={String(r.id)} selected={query.recipient === String(r.id)}>
                      {r.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label for="filter-status" class="mb-1 block text-sm">
                  {L.status}
                </label>
                <select id="filter-status" name="status" class="select w-36">
                  <option value="" selected={query.status === ""}>
                    {L.all}
                  </option>
                  {MEMO_STATUSES.map((s) => (
                    <option value={s} selected={query.status === s}>
                      {MEMO_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset>
                <legend id="filter-period" class="mb-1 block text-sm">
                  {L.period}
                </legend>
                <div class="flex items-center gap-2">
                  <input
                    type="date"
                    name="from"
                    value={query.from}
                    class="input w-40"
                    aria-labelledby="filter-period"
                  />
                  <span>〜</span>
                  <input type="date" name="to" value={query.to} class="input w-40" aria-labelledby="filter-period" />
                </div>
              </fieldset>
              <div class="min-w-48 flex-1">
                <label for="filter-q" class="mb-1 block text-sm">
                  {L.keyword}
                </label>
                <input type="search" id="filter-q" name="q" value={query.q} class="input w-full" />
              </div>
              <button type="submit" class="btn btn-plain">
                {LABELS.search}
              </button>
            </form>
          </search>
          <p class="mt-2 flex flex-wrap gap-2">
            <PendingBadge id="Q-M30" label="宛先の絞り込みの選択肢" />
            <PendingBadge id="Q-M31" label="期間・キーワードの細則" />
          </p>
        </div>
        <a href="/memos/new" class="btn btn-primary">
          {L.createMemo}
        </a>
      </div>

      {noMemos ? (
        <p data-testid="empty">{L.noMemos}</p>
      ) : result.items.length === 0 ? (
        <p data-testid="empty">{L.noMatch}</p>
      ) : (
        <>
          <p class="mb-2">
            <PendingBadge id="Q-M32" label="受電日時が同じときの並び" />
          </p>
          <table class="w-full" data-table="memos">
            <thead>
              <tr class="border-b border-base-300 text-left text-sm text-secondary">
                <th class="px-3 py-2 font-normal">{L.receivedAt}</th>
                <th class="px-3 py-2 font-normal">{L.recipient}</th>
                <th class="px-3 py-2 font-normal">{L.companyName}</th>
                <th class="px-3 py-2 font-normal">{L.personName}</th>
                <th class="px-3 py-2 font-normal">{L.purpose}</th>
                <th class="px-3 py-2 font-normal">{L.status}</th>
                <th class="px-3 py-2 font-normal">{L.createdBy}</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((memo) => {
                const href = `/memos/${memo.id}`;
                return (
                  // 行を押して詳細を開く（F-03）。キーボードでは受電日時のリンクで開く
                  <tr
                    class="cursor-pointer border-b border-base-300 hover:bg-base-200"
                    data-memo-id={String(memo.id)}
                    onclick={`location.href='${href}'`}
                  >
                    <td class="tabular whitespace-nowrap px-3 py-2" data-field="receivedAt">
                      <a href={href} class="link">
                        {formatJst(memo.receivedAt)}
                      </a>
                    </td>
                    <td class="whitespace-nowrap px-3 py-2" data-field="recipient">
                      {nameOf(allRecipients, memo.recipientId, (r) => r.displayName)}
                    </td>
                    <td class="max-w-80 truncate px-3 py-2" data-field="companyName">
                      {memo.companyName}
                    </td>
                    <td class="max-w-48 truncate px-3 py-2" data-field="personName">
                      {memo.personName}
                    </td>
                    <td class="whitespace-nowrap px-3 py-2" data-field="purpose">
                      {MEMO_PURPOSE_LABELS[memo.purpose]}
                    </td>
                    <td class="whitespace-nowrap px-3 py-2" data-field="status">
                      <MemoStatusLabel status={memo.status} />
                    </td>
                    <td class="whitespace-nowrap px-3 py-2" data-field="createdBy">
                      {nameOf(users, memo.createdBy, (u) => u.name)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {result.pageCount > 1 && <Pager query={query} page={result.page} pageCount={result.pageCount} />}
        </>
      )}
    </>
  );
}

// ページ切り替え（仮の形。docs/questions.md Q-M04）：「前へ」「いまのページ / ページの数」「次へ」
function Pager({ query, page, pageCount }: { query: MemoListQuery; page: number; pageCount: number }) {
  const link = (target: number, label: string, rel: string) =>
    target >= 1 && target <= pageCount ? (
      <a href={pageHref(query, target)} class="btn btn-plain" rel={rel}>
        {label}
      </a>
    ) : (
      <span class="btn btn-plain btn-disabled" aria-disabled="true">
        {label}
      </span>
    );
  return (
    <nav class="mt-6 flex items-center gap-4" data-section="pager">
      {link(page - 1, LABELS.prev, "prev")}
      <span class="tabular" data-field="page">
        {page} / {pageCount}
      </span>
      {link(page + 1, LABELS.next, "next")}
      <PendingBadge id="Q-M04" label="ページ切り替えの見せ方" />
    </nav>
  );
}
