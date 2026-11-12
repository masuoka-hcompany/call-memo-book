// 宛先ごとの取次可否（F-08）の表と「保存」ボタン。S-06（会社単位）と S-08（担当者単位）で使う

import { formatJst } from "../domain/datetime.ts";
import { SETTING_LABELS, SETTING_VALUES } from "../domain/setting.ts";
import type { RecipientSetting } from "../repo/settings.ts";
import type { Id, User } from "../repo/types.ts";
import { PendingBadge } from "./components.tsx";
import { SAVE_LABEL } from "./messages.ts";

export const SETTINGS_LABELS = {
  settings: "宛先ごとの取次可否",
  recipient: "宛先",
  setting: "取次可否",
  updatedBy: "更新者",
  updatedAt: "更新日時",
} as const;

// 取次可否の入力欄の name（宛先ごと）
export const settingFieldName = (recipientId: Id) => `setting-${recipientId}`;

// 利用者の名前（更新者の表示）。null や知らない ID なら空
export function userName(users: User[], id: Id | null): string {
  return id === null ? "" : (users.find((u) => u.id === id)?.name ?? "");
}

export function SettingsSection({
  action,
  settings,
  users,
}: {
  // 「保存」の送信先
  action: string;
  settings: RecipientSetting[];
  // 更新者の名前を引くための利用者
  users: User[];
}) {
  const L = SETTINGS_LABELS;
  return (
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading" class="mb-3 border-b-2 border-base-content pb-1 text-lg font-bold">
        {L.settings}
      </h2>
      <p class="mb-2 flex flex-wrap gap-2">
        <PendingBadge id="Q-M17" label="値を変えていない宛先の更新者" />
        <PendingBadge id="Q-M19" label="一度も保存していない取次可否の更新者・更新日時" />
      </p>
      <form method="post" action={action} novalidate>
        <table class="mb-4 w-full max-w-3xl" data-table="settings">
          <thead>
            <tr class="border-b border-base-300 text-left text-sm text-secondary">
              <th class="px-3 py-2 font-normal">{L.recipient}</th>
              <th class="px-3 py-2 font-normal">{L.setting}</th>
              <th class="px-3 py-2 font-normal">{L.updatedBy}</th>
              <th class="px-3 py-2 font-normal">{L.updatedAt}</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => {
              const fieldId = `field-${settingFieldName(s.recipient.id)}`;
              return (
                <tr class="border-b border-base-300" data-recipient-id={String(s.recipient.id)}>
                  <th scope="row" class="px-3 py-2 text-left font-bold">
                    <label for={fieldId}>{s.recipient.displayName}</label>
                  </th>
                  <td class="px-3 py-2">
                    <select id={fieldId} name={settingFieldName(s.recipient.id)} class="select w-40">
                      {SETTING_VALUES.map((v) => (
                        <option value={v} selected={v === s.value}>
                          {SETTING_LABELS[v]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td class="px-3 py-2" data-field="updatedBy">
                    {userName(users, s.updatedBy)}
                  </td>
                  <td class="tabular px-3 py-2" data-field="updatedAt">
                    {s.updatedAt === null ? "" : formatJst(s.updatedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="submit" class="btn btn-primary">
          {SAVE_LABEL}
        </button>
      </form>
    </section>
  );
}
