// S-03 取次メモ詳細の本文（見出し・完了メッセージは AppLayout が出す）
// 仕様：docs/screens/S-03.md

import { formatJst } from "../domain/datetime.ts";
import { MEMO_FIELD_LABELS, MEMO_PURPOSE_LABELS } from "../domain/memo.ts";
import type { Memo, Recipient, User } from "../repo/types.ts";
import { DeleteButton, MemoStatusLabel, PendingBadge } from "./components.tsx";

// 画面の文言（仕様書 7.1・F-03・F-04・F-05）
export const MEMO_DETAIL_LABELS = {
  createdBy: "作成者",
  createdAt: "作成日時",
  status: "状態",
  edit: "編集",
  markDone: "対処済みにする",
  reopen: "未対処に戻す",
} as const;

type Props = {
  memo: Memo;
  // 宛先の表示名（削除された宛先も、取次メモのデータとして残るので表示する）
  recipient: Recipient | null;
  // 作成者
  creator: User | null;
};

export function MemoDetailPage({ memo, recipient, creator }: Props) {
  const L = MEMO_DETAIL_LABELS;
  const F = MEMO_FIELD_LABELS;
  return (
    <>
      <p class="mb-2 flex flex-wrap gap-2">
        <PendingBadge id="Q-M34" label="紐づく会社・担当者を表示するか" />
      </p>
      {/* F-02 の入力項目すべて、作成者、作成日時、状態。更新者・更新日時・対処済みにした人と日時は表示しない（F-03） */}
      <dl class="mb-6 grid max-w-3xl grid-cols-[10rem_1fr] gap-x-6 gap-y-3">
        <dt class="text-sm text-secondary">{F.recipientId}</dt>
        <dd data-field="recipient">{recipient?.displayName ?? ""}</dd>
        <dt class="text-sm text-secondary">{F.receivedAt}</dt>
        <dd data-field="receivedAt" class="tabular">
          {formatJst(memo.receivedAt)}
        </dd>
        <dt class="text-sm text-secondary">{F.companyName}</dt>
        <dd data-field="companyName" class="break-all">
          {memo.companyName}
        </dd>
        <dt class="text-sm text-secondary">{F.personName}</dt>
        <dd data-field="personName" class="break-all">
          {memo.personName}
        </dd>
        <dt class="text-sm text-secondary">{F.phone}</dt>
        <dd data-field="phone" class="tabular">
          {memo.phone}
        </dd>
        <dt class="text-sm text-secondary">{F.purpose}</dt>
        <dd data-field="purpose">{MEMO_PURPOSE_LABELS[memo.purpose]}</dd>
        <dt class="text-sm text-secondary">{F.message}</dt>
        <dd data-field="message" class="whitespace-pre-wrap break-all">
          {memo.message}
        </dd>
        <dt class="text-sm text-secondary">{F.note}</dt>
        <dd data-field="note" class="whitespace-pre-wrap break-all">
          {memo.note}
        </dd>
        <dt class="text-sm text-secondary">{L.createdBy}</dt>
        <dd data-field="createdBy">{creator?.name ?? ""}</dd>
        <dt class="text-sm text-secondary">{L.createdAt}</dt>
        <dd data-field="createdAt" class="tabular">
          {formatJst(memo.createdAt)}
        </dd>
        <dt class="text-sm text-secondary">{L.status}</dt>
        <dd data-field="status">
          <MemoStatusLabel status={memo.status} />
        </dd>
      </dl>
      <div class="flex flex-wrap items-center gap-2">
        {/* 確認ダイアログは出さない（F-05） */}
        <form method="post" action={`/memos/${memo.id}/${memo.status === "open" ? "done" : "reopen"}`}>
          <button type="submit" class="btn btn-plain">
            {memo.status === "open" ? L.markDone : L.reopen}
          </button>
        </form>
        <a href={`/memos/${memo.id}/edit`} class="btn btn-plain">
          {L.edit}
        </a>
        <DeleteButton id="delete-memo" target="memo" action={`/memos/${memo.id}/delete`} />
        <PendingBadge id="Q-M33" label="切り替えの記録（既にその状態のとき・更新者）" />
      </div>
    </>
  );
}
