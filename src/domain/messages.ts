// 入力エラーのメッセージ（仕様書 F-02・F-06・F-07・F-09 の文言のとおり）
// {項目名} には、入力欄の項目名と同じ語を入れる（例：「会社名のよみがな」）。

import { formatNumber } from "./text.ts";

export function requiredMessage(label: string): string {
  return `${label}は必須です`;
}

export function maxLengthMessage(label: string, max: number): string {
  return `${label}は${formatNumber(max)}文字以内で入力してください`;
}

export function kanaMessage(label: string): string {
  return `${label}はひらがなで入力してください`;
}

export const PHONE_LABEL = "電話番号";
export const PHONE_MAX_DIGITS = 15;
export const PHONE_DIGITS_MESSAGE = "電話番号は半角数字のみで入力してください";
export const PHONE_LENGTH_MESSAGE = `電話番号は${PHONE_MAX_DIGITS}桁以内で入力してください`;
export const CALLBACK_PHONE_REQUIRED_MESSAGE = "折り返し希望の場合、電話番号は必須です";
