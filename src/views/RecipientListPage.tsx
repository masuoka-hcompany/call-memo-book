// S-10 宛先一覧の本文（見出し・完了メッセージは AppLayout が出す）
// 仕様：docs/screens/S-10.md

import { formatJst } from "../domain/datetime.ts";
import type { Recipient, User } from "../repo/types.ts";
import { DeleteButton, PendingBadge } from "./components.tsx";
import { userName } from "./SettingsSection.tsx";

export const RECIPIENT_LIST_LABELS = {
  create: "宛先を追加",
  displayName: "表示名",
  email: "メールアドレス",
  updatedBy: "更新者",
  updatedAt: "更新日時",
  edit: "編集",
} as const;

export function RecipientListPage({
  recipients,
  users,
}: {
  recipients: Recipient[];
  // 更新者の名前を引くための利用者
  users: User[];
}) {
  const L = RECIPIENT_LIST_LABELS;
  return (
    <>
      <div class="mb-6 flex items-start justify-between gap-6">
        <p class="flex flex-wrap gap-2">
          <PendingBadge id="Q-M23" label="宛先一覧の並び順・0件のときの表示" />
          <PendingBadge id="Q-M24" label="DB に直接登録した宛先の更新者・更新日時" />
        </p>
        <a href="/recipients/new" class="btn btn-primary">
          {L.create}
        </a>
      </div>
      {recipients.length > 0 && (
        <table class="w-full max-w-5xl" data-table="recipients">
          <thead>
            <tr class="border-b border-base-300 text-left text-sm text-secondary">
              <th class="px-3 py-2 font-normal">{L.displayName}</th>
              <th class="px-3 py-2 font-normal">{L.email}</th>
              <th class="px-3 py-2 font-normal">{L.updatedBy}</th>
              <th class="px-3 py-2 font-normal">{L.updatedAt}</th>
              <th class="px-3 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr class="border-b border-base-300" data-recipient-id={String(r.id)}>
                <td class="px-3 py-2 font-bold" data-field="displayName">
                  {r.displayName}
                </td>
                <td class="px-3 py-2" data-field="email">
                  {r.email}
                </td>
                <td class="px-3 py-2" data-field="updatedBy">
                  {userName(users, r.updatedBy)}
                </td>
                <td class="tabular px-3 py-2" data-field="updatedAt">
                  {r.updatedAt === null ? "" : formatJst(r.updatedAt)}
                </td>
                <td class="px-3 py-2">
                  <div class="flex justify-end gap-2">
                    <a href={`/recipients/${r.id}/edit`} class="btn btn-plain">
                      {L.edit}
                    </a>
                    <DeleteButton
                      id={`delete-recipient-${r.id}`}
                      target="recipient"
                      action={`/recipients/${r.id}/delete`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
