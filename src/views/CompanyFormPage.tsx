// S-07 会社登録・編集の本文（見出しは AppLayout が出す）
// 仕様：docs/screens/S-07.md

import { COMPANY_FIELD_LABELS, type CompanyField, type CompanyInput, type FieldErrors } from "../domain/company.ts";
import { PendingBadge, TextAreaField, TextField } from "./components.tsx";
import { SAVE_LABEL } from "./messages.ts";

export function CompanyFormPage({
  action,
  values,
  errors = {},
}: {
  // 送信先（登録：/companies/new、編集：/companies/:id/edit）
  action: string;
  values: CompanyInput;
  errors?: FieldErrors<CompanyField>;
}) {
  const L = COMPANY_FIELD_LABELS;
  return (
    <>
      <p class="mb-6">
        <PendingBadge id="Q-M16" label="見出しを登録と編集で分けるか" />
      </p>
      <form method="post" action={action} novalidate class="max-w-xl">
        <TextField name="name" label={L.name} value={values.name} errors={errors.name} />
        <TextField name="kana" label={L.kana} value={values.kana} errors={errors.kana} />
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
