// 取次可否のデータアクセス（後で D1 に差し替える。D1 と同じく Promise を返す）
// 会社×宛先、担当者×宛先で1件。行がなければ「未設定」（更新者・更新日時はない）。
// 削除された宛先の取次可否は返さない。

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

type SettingRow = { recipientId: Id; value: SettingValue; updatedBy: Id; updatedAt: Timestamp };

// 削除されていない宛先ごとに、行（なければ「未設定」）を返す（宛先の登録順）
function byRecipient(rows: SettingRow[]): RecipientSetting[] {
  return getStore()
    .recipients.filter((r) => !r.deleted)
    .sort((a, b) => a.id - b.id)
    .map((recipient) => {
      const row = rows.find((s) => s.recipientId === recipient.id);
      return {
        recipient: { ...recipient },
        value: row?.value ?? "unset",
        updatedBy: row?.updatedBy ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });
}

// 変更を記録する。宛先ごとに更新者・更新日時を記録する。行がなければ make で足す
function apply<T extends SettingRow>(
  rows: T[],
  changes: SettingChange[],
  updatedBy: Id,
  now: Date,
  make: (row: SettingRow) => T,
): void {
  const updatedAt = now.toISOString();
  for (const { recipientId, value } of changes) {
    const row = rows.find((s) => s.recipientId === recipientId);
    if (row) {
      Object.assign(row, { value, updatedBy, updatedAt });
    } else {
      rows.push(make({ recipientId, value, updatedBy, updatedAt }));
    }
  }
}

// ---------- 会社単位（S-06） ----------

export async function listCompanySettings(companyId: Id): Promise<RecipientSetting[]> {
  return byRecipient(getStore().companySettings.filter((s) => s.companyId === companyId));
}

export async function saveCompanySettings(
  companyId: Id,
  changes: SettingChange[],
  updatedBy: Id,
  now: Date,
): Promise<void> {
  const { companySettings } = getStore();
  const own = companySettings.filter((s) => s.companyId === companyId);
  apply(own, changes, updatedBy, now, (row) => {
    const added = { companyId, ...row };
    companySettings.push(added);
    return added;
  });
}

// ---------- 担当者単位（S-08） ----------

export async function listContactSettings(contactId: Id): Promise<RecipientSetting[]> {
  return byRecipient(getStore().contactSettings.filter((s) => s.contactId === contactId));
}

export async function saveContactSettings(
  contactId: Id,
  changes: SettingChange[],
  updatedBy: Id,
  now: Date,
): Promise<void> {
  const { contactSettings } = getStore();
  const own = contactSettings.filter((s) => s.contactId === contactId);
  apply(own, changes, updatedBy, now, (row) => {
    const added = { contactId, ...row };
    contactSettings.push(added);
    return added;
  });
}
