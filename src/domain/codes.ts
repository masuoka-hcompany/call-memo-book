// 区分の値（DB に入れるコード値）。画面の表記との対応は docs/db/README.md 1.1。
// DB の CHECK と合っていることは test/db/schema.test.ts が確かめる。

// 取次可否：つなぐ／つながない／未設定
export const SETTING_VALUES = ["connect", "decline", "unset"] as const;
export type SettingValue = (typeof SETTING_VALUES)[number];

// 取次メモの用件：折り返し希望／連絡があったことをお伝え希望／伝言希望
export const MEMO_PURPOSES = ["callback", "notify", "message"] as const;
export type MemoPurpose = (typeof MEMO_PURPOSES)[number];

// 取次メモの状態：未対処／対処済み
export const MEMO_STATUSES = ["open", "done"] as const;
export type MemoStatus = (typeof MEMO_STATUSES)[number];
