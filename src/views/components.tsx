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
