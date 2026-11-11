// 取次メモのデータアクセス（後で D1 に差し替える。D1 と同じく Promise を返す）
// 削除済みの取次メモは既定で除外する。入力チェックは src/domain/memo.ts で済ませてから呼ぶ。
// 一覧・対処済みの切り替え・削除は S-02・S-03 を作るときに足す。

import type { MemoValues } from "../domain/memo.ts";
import { getStore, nextId } from "../mock/store.ts";
import type { Id, Memo } from "./types.ts";

export async function findMemo(id: Id): Promise<Memo | null> {
  const memo = getStore().memos.find((m) => m.id === id && !m.deleted);
  return memo ? { ...memo } : null;
}

function fields(values: MemoValues) {
  return {
    recipientId: values.recipientId,
    receivedAt: values.receivedAt.toISOString(),
    companyName: values.companyName,
    personName: values.personName,
    phone: values.phone,
    purpose: values.purpose,
    message: values.message,
    note: values.note,
  };
}

// 作成する。作成者・作成日時（＝更新者・更新日時）を記録し、状態は「未対処」。
// 登録済みの相手を選んで作成したときは、会社・担当者を紐づける（会社名・氏名・電話番号は入力した値のまま持つ）
export async function createMemo(
  values: MemoValues,
  link: { companyId: Id | null; contactId: Id | null },
  createdBy: Id,
  now: Date,
): Promise<Memo> {
  const { memos } = getStore();
  const at = now.toISOString();
  const memo: Memo = {
    id: nextId(memos),
    ...fields(values),
    companyId: link.companyId,
    contactId: link.contactId,
    status: "open",
    doneBy: null,
    doneAt: null,
    createdBy,
    createdAt: at,
    deleted: false,
    updatedBy: createdBy,
    updatedAt: at,
  };
  memos.push(memo);
  return { ...memo };
}

// 編集する。作成者・作成日時・状態・紐づく会社と担当者は変えない。更新者・更新日時を記録する。
// 削除済み・存在しない取次メモなら null
export async function updateMemo(id: Id, values: MemoValues, updatedBy: Id, now: Date): Promise<Memo | null> {
  const memo = getStore().memos.find((m) => m.id === id && !m.deleted);
  if (!memo) return null;
  Object.assign(memo, fields(values), { updatedBy, updatedAt: now.toISOString() });
  return { ...memo };
}
