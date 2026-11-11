// S-11 宛先追加・編集の本文（見出しは AppLayout が出す）
// 仕様：docs/screens/S-11.md
// 追加時は利用者（プルダウン）、編集時は表示名だけを入力する（仕様書 7.1）。

import type { FieldErrors } from "../domain/company.ts";
import { RECIPIENT_FIELD_LABELS } from "../domain/recipient.ts";
import type { User } from "../repo/types.ts";
import { PendingBadge, SelectField, TextField } from "./components.tsx";
import { SAVE_LABEL } from "./messages.ts";

type Props =
  | {
      mode: "new";
      action: string;
      // プルダウンに出す利用者（既に宛先の利用者・削除された宛先の利用者を除いたもの）
      users: User[];
      // 選んでいる利用者の ID（未選択なら ""）
      userId: string;
      errors?: FieldErrors<"userId">;
    }
  | {
      mode: "edit";
      action: string;
      displayName: string;
      errors?: FieldErrors<"displayName">;
    };

export function RecipientFormPage(props: Props) {
  const L = RECIPIENT_FIELD_LABELS;
  return (
    <>
      <p class="mb-6 flex flex-wrap gap-2">
        <PendingBadge id="Q-M16" label="見出しを登録と編集で分けるか" />
        {props.mode === "new" && <PendingBadge id="Q-M25" label="プルダウンの初期値・選べる利用者がいないとき" />}
      </p>
      <form method="post" action={props.action} novalidate class="max-w-xl">
        {props.mode === "new" ? (
          <SelectField
            name="userId"
            label={L.userId}
            value={props.userId}
            options={props.users.map((u) => ({ value: String(u.id), label: u.name }))}
            errors={props.errors?.userId}
          />
        ) : (
          <TextField
            name="displayName"
            label={L.displayName}
            value={props.displayName}
            errors={props.errors?.displayName}
          />
        )}
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
