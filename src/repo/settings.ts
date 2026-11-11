// 取次可否のデータアクセス（後で D1 に差し替える。D1 と同じく Promise を返す）
// 会社×宛先、担当者×宛先で1件。行がなければ「未設定」（更新者・更新日時はない）。
// 削除された宛先の取次可否は返さない。担当者単位は S-08 を作るときに足す。

import type { SettingChange, SettingValue } from "../domain/setting.ts";
import { getStore } from "../mock/store.ts";
import type { Id, Recipient, Timestamp } from "./types.ts";

export type RecipientSetting = {
  recipient: Recipient;
  value: SettingValue;
  // 一度も保存していなければ null
  updatedBy: Id | null;
  updatedAt: Timestamp | null;
};

// 会社の取次可否を、削除されていない宛先ごとに返す（宛先の登録順）
export async function listCompanySettings(companyId: Id): Promise<RecipientSetting[]> {
  const { recipients, companySettings } = getStore();
  return recipients
    .filter((r) => !r.deleted)
    .sort((a, b) => a.id - b.id)
    .map((recipient) => {
      const row = companySettings.find((s) => s.companyId === companyId && s.recipientId === recipient.id);
      return {
        recipient: { ...recipient },
        value: row?.value ?? "unset",
        updatedBy: row?.updatedBy ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });
}

// 会社の取次可否を記録する。宛先ごとに更新者・更新日時を記録する
export async function saveCompanySettings(
  companyId: Id,
  changes: SettingChange[],
  updatedBy: Id,
  now: Date,
): Promise<void> {
  const { companySettings } = getStore();
  const updatedAt = now.toISOString();
  for (const { recipientId, value } of changes) {
    const row = companySettings.find((s) => s.companyId === companyId && s.recipientId === recipientId);
    if (row) {
      Object.assign(row, { value, updatedBy, updatedAt });
    } else {
      companySettings.push({ companyId, recipientId, value, updatedBy, updatedAt });
    }
  }
}
