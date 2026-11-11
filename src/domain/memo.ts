// 取次メモの区分（仕様書 8.2）

export const MEMO_PURPOSES = ["callback", "notify", "message"] as const;
export type MemoPurpose = (typeof MEMO_PURPOSES)[number];

export const MEMO_PURPOSE_LABELS: Record<MemoPurpose, string> = {
  callback: "折り返し希望",
  notify: "連絡があったことをお伝え希望",
  message: "伝言希望",
};

export const MEMO_STATUSES = ["open", "done"] as const;
export type MemoStatus = (typeof MEMO_STATUSES)[number];

export const MEMO_STATUS_LABELS: Record<MemoStatus, string> = {
  open: "未対処",
  done: "対処済み",
};
