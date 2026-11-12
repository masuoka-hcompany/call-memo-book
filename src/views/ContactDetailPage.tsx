// S-08 担当者詳細の本文（見出し・完了メッセージは AppLayout が出す）
// 仕様：docs/screens/S-08.md

import { COMPANY_FIELD_LABELS } from "../domain/company.ts";
import { CONTACT_FIELD_LABELS } from "../domain/contact.ts";
import { formatJst } from "../domain/datetime.ts";
import { displayName } from "../domain/text.ts";
import type { RecipientSetting } from "../repo/settings.ts";
import type { Company, Contact, User } from "../repo/types.ts";
import { DeleteButton, PendingBadge } from "./components.tsx";
import { SETTINGS_LABELS, SettingsSection, userName } from "./SettingsSection.tsx";

export const CONTACT_DETAIL_LABELS = {
  updatedBy: SETTINGS_LABELS.updatedBy,
  updatedAt: SETTINGS_LABELS.updatedAt,
  edit: "編集",
} as const;

type Props = {
  contact: Contact;
  // 所属する会社
  company: Company;
  settings: RecipientSetting[];
  // 更新者の名前を引くための利用者
  users: User[];
};

export function ContactDetailPage({ contact, company, settings, users }: Props) {
  const L = CONTACT_DETAIL_LABELS;
  const F = CONTACT_FIELD_LABELS;
  return (
    <>
      <p class="mb-2">
        <PendingBadge id="Q-M22" label="所属する会社を表示するか" />
      </p>
      {/* 担当者の情報 */}
      <dl class="mb-6 grid max-w-3xl grid-cols-[10rem_1fr] gap-x-6 gap-y-3">
        <dt class="text-sm text-secondary">{COMPANY_FIELD_LABELS.name}</dt>
        <dd data-field="company">
          <a href={`/companies/${company.id}`} class="link">
            {displayName(company.name, company.kana)}
          </a>
        </dd>
        <dt class="text-sm text-secondary">{F.name}</dt>
        <dd data-field="name">{displayName(contact.name, contact.kana)}</dd>
        <dt class="text-sm text-secondary">{F.kana}</dt>
        <dd data-field="kana">{contact.kana}</dd>
        <dt class="text-sm text-secondary">{F.phone}</dt>
        <dd data-field="phone" class="tabular">
          {contact.phone}
        </dd>
        <dt class="text-sm text-secondary">{F.memo}</dt>
        <dd data-field="memo" class="whitespace-pre-wrap">
          {contact.memo}
        </dd>
        <dt class="text-sm text-secondary">{L.updatedBy}</dt>
        <dd data-field="updatedBy">{userName(users, contact.updatedBy)}</dd>
        <dt class="text-sm text-secondary">{L.updatedAt}</dt>
        <dd data-field="updatedAt" class="tabular">
          {formatJst(contact.updatedAt)}
        </dd>
      </dl>
      <div class="mb-10 flex gap-2">
        <a href={`/contacts/${contact.id}/edit`} class="btn btn-plain">
          {L.edit}
        </a>
        <DeleteButton id="delete-contact" target="contact" action={`/contacts/${contact.id}/delete`} />
      </div>

      {/* 宛先ごとの取次可否（担当者単位） */}
      <SettingsSection action={`/contacts/${contact.id}/settings`} settings={settings} users={users} />
    </>
  );
}
