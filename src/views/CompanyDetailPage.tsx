// S-06 会社詳細の本文（見出し・完了メッセージは AppLayout が出す）
// 仕様：docs/screens/S-06.md

import { COMPANY_FIELD_LABELS } from "../domain/company.ts";
import { formatJst } from "../domain/datetime.ts";
import { SETTING_LABELS, SETTING_VALUES } from "../domain/setting.ts";
import { displayName } from "../domain/text.ts";
import type { RecipientSetting } from "../repo/settings.ts";
import type { Company, Contact, Id, User } from "../repo/types.ts";
import { DeleteButton, PendingBadge } from "./components.tsx";
import { SAVE_LABEL } from "./messages.ts";

export const COMPANY_DETAIL_LABELS = {
  updatedBy: "更新者",
  updatedAt: "更新日時",
  edit: "編集",
  contacts: "担当者一覧",
  addContact: "担当者を追加",
  contactName: "担当者名",
  phone: "電話番号",
  settings: "宛先ごとの取次可否",
  recipient: "宛先",
  setting: "取次可否",
} as const;

// 取次可否の入力欄の name（宛先ごと）
export const settingFieldName = (recipientId: Id) => `setting-${recipientId}`;

type Props = {
  company: Company;
  contacts: Contact[];
  settings: RecipientSetting[];
  // 更新者の名前を引くための利用者
  users: User[];
};

function userName(users: User[], id: Id | null): string {
  return id === null ? "" : (users.find((u) => u.id === id)?.name ?? "");
}

export function CompanyDetailPage({ company, contacts, settings, users }: Props) {
  const L = COMPANY_DETAIL_LABELS;
  const F = COMPANY_FIELD_LABELS;
  return (
    <>
      {/* 会社の情報 */}
      <dl class="mb-6 grid max-w-3xl grid-cols-[10rem_1fr] gap-x-6 gap-y-3">
        <dt class="text-sm text-secondary">{F.name}</dt>
        <dd data-field="name">{displayName(company.name, company.kana)}</dd>
        <dt class="text-sm text-secondary">{F.kana}</dt>
        <dd data-field="kana">{company.kana}</dd>
        <dt class="text-sm text-secondary">{F.memo}</dt>
        <dd data-field="memo" class="whitespace-pre-wrap">
          {company.memo}
        </dd>
        <dt class="text-sm text-secondary">{L.updatedBy}</dt>
        <dd data-field="updatedBy">{userName(users, company.updatedBy)}</dd>
        <dt class="text-sm text-secondary">{L.updatedAt}</dt>
        <dd data-field="updatedAt" class="tabular">
          {formatJst(company.updatedAt)}
        </dd>
      </dl>
      <div class="mb-10 flex gap-2">
        <a href={`/companies/${company.id}/edit`} class="btn btn-plain">
          {L.edit}
        </a>
        <DeleteButton id="delete-company" target="company" action={`/companies/${company.id}/delete`} />
      </div>

      {/* 担当者一覧 */}
      <section class="mb-10" aria-labelledby="contacts-heading">
        <div class="mb-3 flex items-center justify-between gap-4 border-b-2 border-base-content pb-1">
          <h2 id="contacts-heading" class="text-lg font-bold">
            {L.contacts}
          </h2>
          <a href={`/companies/${company.id}/contacts/new`} class="btn btn-plain">
            {L.addContact}
          </a>
        </div>
        <p class="mb-2">
          <PendingBadge id="Q-M18" label="担当者一覧の項目・並び順・0人のときの表示" />
        </p>
        {contacts.length > 0 && (
          <table class="w-full max-w-3xl" data-table="contacts">
            <thead>
              <tr class="border-b border-base-300 text-left text-sm text-secondary">
                <th class="px-3 py-2 font-normal">{L.contactName}</th>
                <th class="px-3 py-2 font-normal">{L.phone}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr class="border-b border-base-300">
                  <td class="px-3 py-2">
                    <a href={`/contacts/${contact.id}`} class="link">
                      {displayName(contact.name, contact.kana)}
                    </a>
                  </td>
                  <td class="tabular px-3 py-2">{contact.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 宛先ごとの取次可否（会社単位） */}
      <section aria-labelledby="settings-heading">
        <h2 id="settings-heading" class="mb-3 border-b-2 border-base-content pb-1 text-lg font-bold">
          {L.settings}
        </h2>
        <p class="mb-2 flex flex-wrap gap-2">
          <PendingBadge id="Q-M17" label="値を変えていない宛先の更新者" />
          <PendingBadge id="Q-M19" label="一度も保存していない取次可否の更新者・更新日時" />
        </p>
        <form method="post" action={`/companies/${company.id}/settings`} novalidate>
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
    </>
  );
}
