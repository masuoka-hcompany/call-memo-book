// 宛先のデータアクセス（後で D1 に差し替える。D1 と同じく Promise を返す）
// 削除済みの宛先は既定で除外する。削除済みも含めて取る関数は名前に IncludingDeleted を付ける。
// 追加・編集・削除は S-10・S-11 を作るときに足す。

import { getStore } from "../mock/store.ts";
import type { Recipient } from "./types.ts";

export async function listRecipients(): Promise<Recipient[]> {
  return getStore()
    .recipients.filter((r) => !r.deleted)
    .map((r) => ({ ...r }));
}

export async function listRecipientsIncludingDeleted(): Promise<Recipient[]> {
  return getStore().recipients.map((r) => ({ ...r }));
}
