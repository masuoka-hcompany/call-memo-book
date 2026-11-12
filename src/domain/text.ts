// 文字数の数え方と表示（仕様書 F-02「文字数は、全角・半角を区別せず1文字と数える（すべての機能で共通）」）

// 改行を LF にそろえる。ブラウザはフォームの改行を CRLF で送る。
// 改行を何文字と数えるかは未決（docs/questions.md Q-M06）。仮に LF にそろえて1文字と数える。
export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

// 文字数。JS の length（UTF-16 の単位）ではなく、コードポイント数で数える。
export function countChars(value: string): number {
  return [...normalizeNewlines(value)].length;
}

// 1行の欄（会社名・担当者名・氏名・よみがな・表示名・電話番号）の入力をそろえる：前後の空白を削る
// （半角・全角スペース、タブ、改行。JS の trim は全角スペース U+3000 も削る）。間の空白は残す。
// 複数行の欄（伝言・メモ）には使わず、入力どおりに保存する。
// 入力チェック・文字数の判定は、削ったあとの値で行う（docs/questions.md Q-M11。2026-11-11 決定）。
export function trimSingleLine(value: string): string {
  return value.trim();
}

// 入力が空か。空文字と、空白（半角・全角スペース、タブ、改行など）だけの入力を空とみなす
// （docs/questions.md Q-M07。2026-11-11 決定）。JS の \s は全角スペース U+3000 も含む。
export function isEmpty(value: string): boolean {
  return /^\s*$/u.test(value);
}

// 数値をカンマ区切りで表示する（例：1000 → "1,000"）
export function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 会社名・担当者名が空のときは、名前の代わりによみがなを表示する（仕様書 F-01・F-06・F-07・8.1）
export function displayName(name: string, kana: string): string {
  return isEmpty(name) ? kana : name;
}
