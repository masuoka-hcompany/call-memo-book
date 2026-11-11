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

// 入力が空か。空文字と、半角・全角スペースだけの入力を空とみなす（docs/questions.md Q-M07。2026-11-11 決定）。
// 前後の空白は削らない（空でなければ入力どおりに保存する）。
// タブ・改行だけの入力は空とみなさない（決まっていないため。Q-M07 に記録）。
export function isEmpty(value: string): boolean {
  return /^[ 　]*$/u.test(value);
}

// 数値をカンマ区切りで表示する（例：1000 → "1,000"）
export function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 会社名・担当者名が空のときは、名前の代わりによみがなを表示する（仕様書 F-01・F-06・F-07・8.1）
export function displayName(name: string, kana: string): string {
  return isEmpty(name) ? kana : name;
}
