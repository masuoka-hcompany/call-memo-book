// S-09 担当者登録・編集の本文（見出しは AppLayout が出す）
// 仕様：docs/screens/S-09.md

import type { FieldErrors } from "../domain/company.ts";
import { CONTACT_FIELD_LABELS, type ContactField, type ContactInput } from "../domain/contact.ts";
import { PendingBadge, TextAreaField, TextField } from "./components.tsx";
import { SAVE_LABEL } from "./messages.ts";

export function ContactFormPage({
  action,
  values,
  errors = {},
}: {
  // 送信先（登録：/companies/:id/contacts/new、編集：/contacts/:id/edit）
  action: string;
  values: ContactInput;
  errors?: FieldErrors<ContactField>;
}) {
  const L = CONTACT_FIELD_LABELS;
  return (
    <>
      <p class="mb-6 flex flex-wrap gap-2">
        <PendingBadge id="Q-M16" label="見出しを登録と編集で分けるか" />
        <PendingBadge id="Q-M20" label="所属する会社を表示するか" />
      </p>
      <form method="post" action={action} novalidate class="max-w-xl">
        <TextField name="name" label={L.name} value={values.name} errors={errors.name} />
        <TextField name="kana" label={L.kana} value={values.kana} errors={errors.kana} />
        <TextField name="phone" label={L.phone} value={values.phone} errors={errors.phone} />
        <TextAreaField name="memo" label={L.memo} value={values.memo} errors={errors.memo} />
        <div class="flex items-center gap-4">
          <button type="submit" class="btn btn-primary">
            {SAVE_LABEL}
          </button>
          <PendingBadge id="Q-M15" label="保存せずに入力をやめる操作" />
        </div>
      </form>
    </>
  );
}
