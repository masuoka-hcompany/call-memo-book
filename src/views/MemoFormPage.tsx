// S-04 取次メモ作成・編集の本文（見出しは AppLayout が出す）
// 仕様：docs/screens/S-04.md

import type { FieldErrors } from "../domain/company.ts";
import {
  MEMO_FIELD_LABELS,
  MEMO_PURPOSE_LABELS,
  MEMO_PURPOSES,
  type MemoField,
  type MemoInput,
} from "../domain/memo.ts";
import type { Recipient } from "../repo/types.ts";
import { PendingBadge, SelectField, TextAreaField, TextField } from "./components.tsx";
import { SAVE_LABEL } from "./messages.ts";

type Props = {
  // 送信先（作成：/memos/new、編集：/memos/:id/edit）
  action: string;
  values: MemoInput;
  // 宛先のプルダウン（削除されていない宛先）
  recipients: Recipient[];
  // 作成のとき、S-01 で選んだ相手（紐づける会社・担当者）。編集のときは渡さない
  link?: { companyId: number | null; contactId: number | null };
  errors?: FieldErrors<MemoField>;
};

export function MemoFormPage({ action, values, recipients, link, errors = {} }: Props) {
  const L = MEMO_FIELD_LABELS;
  return (
    <>
      <p class="mb-6 flex flex-wrap gap-2">
        <PendingBadge id="Q-M16" label="見出しを作成と編集で分けるか" />
        <PendingBadge id="Q-M29" label="用件の入力の形と初期値" />
        <PendingBadge id="Q-M28" label="選べない値・形式が違う値が送られたとき" />
      </p>
      <form method="post" action={action} novalidate class="max-w-xl">
        {link?.companyId != null && <input type="hidden" name="companyId" value={String(link.companyId)} />}
        {link?.contactId != null && <input type="hidden" name="contactId" value={String(link.contactId)} />}
        <SelectField
          name="recipientId"
          label={L.recipientId}
          value={values.recipientId}
          options={recipients.map((r) => ({ value: String(r.id), label: r.displayName }))}
          errors={errors.recipientId}
        />
        <TextField
          name="receivedAt"
          type="datetime-local"
          label={L.receivedAt}
          value={values.receivedAt}
          errors={errors.receivedAt}
        />
        <TextField name="companyName" label={L.companyName} value={values.companyName} errors={errors.companyName} />
        <TextField name="personName" label={L.personName} value={values.personName} errors={errors.personName} />
        <TextField name="phone" label={L.phone} value={values.phone} errors={errors.phone} />
        <SelectField
          name="purpose"
          label={L.purpose}
          value={values.purpose}
          options={MEMO_PURPOSES.map((p) => ({ value: p, label: MEMO_PURPOSE_LABELS[p] }))}
          errors={errors.purpose}
        />
        <TextAreaField name="message" label={L.message} value={values.message} errors={errors.message} rows={6} />
        <TextAreaField name="note" label={L.note} value={values.note} errors={errors.note} />
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
