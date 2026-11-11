// 取次メモの一覧・検索のルール（仕様書 F-03）：S-02 取次メモ一覧
//
// - 絞り込み：宛先（「自分宛て」を含む）、状態（未対処／対処済み／すべて）、受電日時の期間
// - キーワード：会社名・氏名・電話番号・伝言・メモのいずれかに部分一致
// - 並び順は受電日時の新しい順。1ページ50件
// - 削除された取次メモは表示しない

import { jstStartOfDay } from "./datetime.ts";
import { MEMO_STATUSES, type MemoStatus } from "./memo.ts";
import { isEmpty } from "./text.ts";

export const MEMO_PAGE_SIZE = 50;

// 宛先の絞り込みで「自分宛て」を表す値
export const RECIPIENT_FILTER_ME = "me";

// 画面から送られた絞り込み条件（URL のクエリ。すべて文字列。未指定は ""）
export type MemoListQuery = {
  // ""：すべて、"me"：自分宛て、数字：その宛先
  recipient: string;
  // ""：すべて、"open"：未対処、"done"：対処済み
  status: string;
  // 受電日時の期間（<input type="date"> の値「2026-11-02」。日本時間の日付）
  from: string;
  to: string;
  // キーワード
  q: string;
  // ページ番号（1から）
  page: string;
};

export const EMPTY_MEMO_LIST_QUERY: MemoListQuery = { recipient: "", status: "", from: "", to: "", q: "", page: "" };

export type MemoFilter = {
  recipient: "all" | "me" | number;
  status: "all" | MemoStatus;
  // 受電日時がこの日時以上（UTC）
  from: Date | null;
  // 受電日時がこの日時より前（UTC。終わりの日の翌日 0:00）
  toExclusive: Date | null;
  keyword: string;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 送られた値を絞り込み条件にする。読めない値は、その条件で絞り込まない（仮。docs/questions.md Q-M31）
// - 期間は日本時間の日付で、始まりの日の 0:00 から終わりの日の 23:59 まで（両端の日を含む）
// - キーワードが空・空白だけなら絞り込まない。空白を含む語は入力どおりに比べる（S-01 と同じ。Q-M26）
export function parseMemoFilter(query: MemoListQuery): MemoFilter {
  const recipient =
    query.recipient === RECIPIENT_FILTER_ME ? "me" : /^[0-9]+$/.test(query.recipient) ? Number(query.recipient) : "all";
  const status = (MEMO_STATUSES as readonly string[]).includes(query.status) ? (query.status as MemoStatus) : "all";
  const to = jstStartOfDay(query.to);
  return {
    recipient,
    status,
    from: jstStartOfDay(query.from),
    toExclusive: to ? new Date(to.getTime() + ONE_DAY_MS) : null,
    keyword: isEmpty(query.q) ? "" : query.q,
  };
}

type MemoLike = {
  id: number;
  recipientId: number;
  receivedAt: string;
  createdAt: string;
  companyName: string;
  personName: string;
  phone: string;
  message: string;
  note: string;
  status: MemoStatus;
  deleted: boolean;
};

// 受電日時の新しい順。受電日時が同じなら、後から作成したものを先にする（仮。Q-M32）
export function compareMemos(a: MemoLike, b: MemoLike): number {
  return (
    Date.parse(b.receivedAt) - Date.parse(a.receivedAt) ||
    Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
    b.id - a.id
  );
}

// 条件に合う取次メモを、表示する順に返す。削除された取次メモは返さない。
// myRecipientIds：ログイン中の利用者と同じメールアドレスの宛先（「自分宛て」。F-09）。宛先でない利用者なら空
export function filterMemos<M extends MemoLike>(memos: M[], filter: MemoFilter, myRecipientIds: number[]): M[] {
  const { keyword } = filter;
  return memos
    .filter((m) => !m.deleted)
    .filter((m) => {
      if (filter.recipient === "me" && !myRecipientIds.includes(m.recipientId)) return false;
      if (typeof filter.recipient === "number" && m.recipientId !== filter.recipient) return false;
      if (filter.status !== "all" && m.status !== filter.status) return false;
      const at = Date.parse(m.receivedAt);
      if (filter.from && at < filter.from.getTime()) return false;
      if (filter.toExclusive && at >= filter.toExclusive.getTime()) return false;
      if (keyword !== "") {
        const fields = [m.companyName, m.personName, m.phone, m.message, m.note];
        if (!fields.some((f) => f.includes(keyword))) return false;
      }
      return true;
    })
    .sort(compareMemos);
}

export type MemoPage<M> = {
  items: M[];
  // いまのページ（1から）
  page: number;
  // ページの数（0件のときは 1）
  pageCount: number;
};

// 1ページ50件に分ける。ページ番号が読めないときは1ページ目、ページの数を超えるときは最後のページ（仮。Q-M04）
export function paginate<M>(items: M[], page: string, size = MEMO_PAGE_SIZE): MemoPage<M> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const requested = /^[0-9]+$/.test(page) ? Number(page) : 1;
  const current = Math.min(Math.max(requested, 1), pageCount);
  return { items: items.slice((current - 1) * size, current * size), page: current, pageCount };
}
