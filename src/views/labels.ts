// 仕様書にない汎用の文言（CLAUDE.md「絶対に守るルール」）
// 全画面で同じ語にそろえるため、画面からはここの値を使う。

export const LABELS = {
  search: "検索",
  cancel: "キャンセル", // 確認ダイアログのキャンセル側（仮。docs/questions.md Q-M03）
  prev: "前へ",
  next: "次へ",
  back: "戻る",
} as const;
