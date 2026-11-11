// 複数の画面で使う部品（見た目のルールは docs/design.md、見本は /__styleguide）

import type { Child } from "hono/jsx";
import { LABELS } from "./labels.ts";
import { CONFIRM_DELETE_MESSAGES, DELETE_CONFIRM_LABEL, DELETE_LABEL } from "./messages.ts";

// 【未決】バッジ（モック専用。design.md 4.10）。id は docs/questions.md の ID
export function PendingBadge({ id, label }: { id: string; label: string }) {
  return (
    <span class="badge badge-warning">
      【未決】{id} {label}
    </span>
  );
}

// モック専用の表示を囲む枠（黄の破線と薄い黄の面。仕様の画面要素と区別する。design.md 4.6）
export function MockBox({ children, class: cls = "" }: { children: Child; class?: string }) {
  return <div class={`border border-dashed border-warning bg-warning/20 px-2 py-1 text-sm ${cls}`}>{children}</div>;
}

// 完了メッセージ（design.md 4.7）。画面の見出しの下・本文の上に置く
export function FlashMessage({ message }: { message: string }) {
  return (
    <p class="flash-done mb-6 px-4 py-3" role="status">
      {message}
    </p>
  );
}

// ---------- 入力欄（design.md 4.2・4.3） ----------
// 項目名は入力欄の上に置き、<label> でつなぐ。ブラウザの入力チェックは使わない（required・maxlength を付けない）。
// エラーは入力欄のすぐ下に1行ずつ並べ、aria-describedby でつなぐ（1つの欄に複数のエラーもある。Q-M09）。

type FieldProps = {
  // name と id（id は "field-{name}"）
  name: string;
  // 項目名（エラーメッセージの {項目名} と同じ）
  label: string;
  value: string;
  errors?: string[] | undefined;
};

function FieldErrors({ id, errors }: { id: string; errors: string[] }) {
  return (
    <div id={id}>
      {errors.map((message) => (
        <p class="error-text mt-1 text-sm">{message}</p>
      ))}
    </div>
  );
}

function fieldAttrs(name: string, errors: string[] | undefined) {
  const id = `field-${name}`;
  const hasError = errors !== undefined && errors.length > 0;
  return {
    id,
    errorId: `${id}-error`,
    hasError,
    aria: hasError ? { "aria-invalid": "true", "aria-describedby": `${id}-error` } : {},
  };
}

// 1行の入力欄
export function TextField({ name, label, value, errors }: FieldProps) {
  const f = fieldAttrs(name, errors);
  return (
    <div class="mb-5">
      <label for={f.id} class="mb-1 block text-sm">
        {label}
      </label>
      <input
        type="text"
        id={f.id}
        name={name}
        value={value}
        class={`input w-full max-w-xl ${f.hasError ? "input-error" : ""}`}
        {...f.aria}
      />
      {f.hasError && <FieldErrors id={f.errorId} errors={errors as string[]} />}
    </div>
  );
}

// 複数行の入力欄
export function TextAreaField({ name, label, value, errors, rows = 4 }: FieldProps & { rows?: number }) {
  const f = fieldAttrs(name, errors);
  return (
    <div class="mb-5">
      <label for={f.id} class="mb-1 block text-sm">
        {label}
      </label>
      <textarea
        id={f.id}
        name={name}
        rows={rows}
        class={`textarea w-full max-w-xl ${f.hasError ? "textarea-error" : ""}`}
        {...f.aria}
      >
        {/* HTML は <textarea> 直後の改行を1つ読み飛ばすため、改行で始まる値を残すように改行を1つ足す */}
        {`\n${value}`}
      </textarea>
      {f.hasError && <FieldErrors id={f.errorId} errors={errors as string[]} />}
    </div>
  );
}

// プルダウン。先頭に空の選択肢（未選択）を置く。value はいま選んでいる値（未選択なら ""）
export function SelectField({
  name,
  label,
  value,
  options,
  errors,
}: FieldProps & { options: { value: string; label: string }[] }) {
  const f = fieldAttrs(name, errors);
  return (
    <div class="mb-5">
      <label for={f.id} class="mb-1 block text-sm">
        {label}
      </label>
      <select id={f.id} name={name} class={`select w-full max-w-xl ${f.hasError ? "select-error" : ""}`} {...f.aria}>
        <option value="" selected={value === ""} />
        {options.map((o) => (
          <option value={o.value} selected={o.value === value}>
            {o.label}
          </option>
        ))}
      </select>
      {f.hasError && <FieldErrors id={f.errorId} errors={errors as string[]} />}
    </div>
  );
}

type DeleteTarget = keyof typeof CONFIRM_DELETE_MESSAGES;

// 「削除」ボタンと削除の確認ダイアログ（design.md 4.9）
// 「削除する」で action に POST する（null なら送信せずに閉じる。/__styleguide の見本用）。
// ボタン名「キャンセル」「削除する」は仮（docs/questions.md Q-M03）。
export function DeleteButton({
  id,
  target,
  action,
}: {
  // ダイアログの id（1画面に複数あるときに区別する）
  id: string;
  target: DeleteTarget;
  action: string | null;
}) {
  const messageId = `${id}-message`;
  return (
    <>
      <button type="button" class="btn btn-plain" onclick={`document.getElementById('${id}').showModal()`}>
        {DELETE_LABEL}
      </button>
      <dialog id={id} class="modal" aria-describedby={messageId}>
        <div class="modal-box">
          <DeleteDialogBody target={target} action={action} messageId={messageId} />
        </div>
      </dialog>
    </>
  );
}

// 確認ダイアログの中身（/__styleguide の「開いた状態」の見本でも使う）
export function DeleteDialogBody({
  target,
  action,
  messageId,
}: {
  target: DeleteTarget;
  action: string | null;
  messageId?: string;
}) {
  return (
    <>
      <p id={messageId}>{CONFIRM_DELETE_MESSAGES[target]}</p>
      <div class="modal-action">
        <form method="dialog">
          <button type="submit" class="btn btn-quiet">
            {LABELS.cancel}
          </button>
        </form>
        <form {...(action === null ? { method: "dialog" } : { method: "post", action })}>
          <button type="submit" class="btn btn-plain">
            {DELETE_CONFIRM_LABEL}
          </button>
        </form>
      </div>
    </>
  );
}
