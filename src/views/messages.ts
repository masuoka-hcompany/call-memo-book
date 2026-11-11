// 仕様書の文言のうち、複数の画面で使うもの（完了メッセージ・削除の確認ダイアログ）
// 文言は docs/spec.md 6章のとおり。言い換えない。

// 完了メッセージ（処理のあとの画面の見出しの下に出す）
export const FLASH_MESSAGES = {
  memoCreated: "取次メモを登録しました", // F-02
  memoUpdated: "取次メモを更新しました", // F-04
  memoDeleted: "取次メモを削除しました", // F-04
  memoDone: "対処済みにしました", // F-05
  memoReopened: "未対処に戻しました", // F-05
  companyCreated: "会社を登録しました", // F-06
  companyUpdated: "会社を更新しました", // F-06
  companyDeleted: "会社を削除しました", // F-06
  contactCreated: "担当者を登録しました", // F-07
  contactUpdated: "担当者を更新しました", // F-07
  contactDeleted: "担当者を削除しました", // F-07
  settingsUpdated: "取次可否を更新しました", // F-08
  recipientCreated: "宛先を登録しました", // F-09
  recipientUpdated: "宛先を更新しました", // F-09
  recipientDeleted: "宛先を削除しました", // F-09
} as const;

export type FlashKey = keyof typeof FLASH_MESSAGES;

export function isFlashKey(value: unknown): value is FlashKey {
  return typeof value === "string" && Object.hasOwn(FLASH_MESSAGES, value);
}

// 削除の確認ダイアログ
export const CONFIRM_DELETE_MESSAGES = {
  memo: "この取次メモを削除しますか？", // F-04
  company: "この会社を削除しますか？ 所属する担当者も削除されます", // F-06
  contact: "この担当者を削除しますか？", // F-07
  recipient: "この宛先を削除しますか？", // F-09
} as const;

// ボタン名（仕様書の操作の流れ「「削除」を押す」「「削除する」を押す」）
export const DELETE_LABEL = "削除";
export const DELETE_CONFIRM_LABEL = "削除する";
