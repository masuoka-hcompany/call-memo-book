// メモリ上のデータ（モック専用。DB の代わり）
//
// - データは蓄積しない。Worker のインスタンスができたときはデモデータ（GET /__seed/demo と同じ）で始まる。
// - インスタンスが入れ替わると元に戻り、インスタンスが複数あると画面ごとにデータが食い違うことがある（モックなのでそれでよい）。
// - 読み書きは src/repo/ を通す。直接書き換えてよいのはシード（/__seed/*）だけ。

import type { Company, CompanySetting, Contact, ContactSetting, Memo, Recipient, User } from "../repo/types.ts";
import { buildDemoData } from "./seeds.ts";

// 仕様書 8.1 の7種類
export type StoreData = {
  users: User[];
  recipients: Recipient[];
  companies: Company[];
  contacts: Contact[];
  companySettings: CompanySetting[];
  contactSettings: ContactSetting[];
  memos: Memo[];
};

let data: StoreData | null = null;

// 初めて使うときにデモデータを入れる（Workers のグローバルスコープでは日時などが使えないため、遅れて作る）
export function getStore(): StoreData {
  if (data === null) {
    data = buildDemoData();
  }
  return data;
}

// データを丸ごと入れ替える（シード専用）
export function replaceStore(next: StoreData): void {
  data = next;
}

// 削除済みを含む全データの写し（/__debug/store 用）
export function snapshotStore(): StoreData {
  return structuredClone(getStore());
}

// 次の ID（いまの最大値 + 1）
export function nextId(rows: readonly { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}
