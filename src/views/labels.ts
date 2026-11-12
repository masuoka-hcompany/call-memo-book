// 仕様書にない汎用の文言（CLAUDE.md「絶対に守るルール」）
// 全画面で同じ語にそろえるため、画面からはここの値を使う。

export const LABELS = {
  search: "検索",
  cancel: "キャンセル", // 確認ダイアログのキャンセル側（仮。docs/questions.md Q-M03）
  prev: "前へ",
  next: "次へ",
  back: "戻る",
} as const;

// モック専用の表示（仕様の画面要素ではない。黄の破線枠で囲んで区別する）
export const MOCK_LABELS = {
  userSwitch: "モック用：ログインユーザー切替",
  notBuilt: "モック用：この画面はまだ作っていません",
} as const;
