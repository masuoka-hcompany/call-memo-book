// 入力チェック（サーバー側で行う。ブラウザの入力チェックは使わない）
//
// 1つの欄に当てはまるエラーは、すべて返す。順番は「形式 → 文字数」（docs/questions.md Q-M09。2026-11-11 決定）。
// - 空のときは「必須」のエラーだけ（形式・文字数は確かめようがない）
// - 電話番号は例外で、半角数字以外が含まれるときは「半角数字のみ」のエラーだけを返し、桁数は確かめない

import {
  kanaMessage,
  maxLengthMessage,
  PHONE_DIGITS_MESSAGE,
  PHONE_LENGTH_MESSAGE,
  PHONE_MAX_DIGITS,
  requiredMessage,
} from "./messages.ts";
import { countChars, isEmpty } from "./text.ts";

// 文字数の上限（仕様書 F-02・F-06・F-07・F-09）
export const NAME_MAX = 255;
export const LONG_TEXT_MAX = 1000;

// よみがなに使える文字（docs/questions.md Q-M08。2026-11-11 決定）
// - ひらがな（U+3041〜U+3096。小書き文字・「ゔ」「ゕ」「ゖ」を含む）
// - 長音「ー」（U+30FC）
// - 全角スペース（U+3000）・半角スペース（U+0020）
// 踊り字「ゝ」「ゞ」・濁点の記号「゛」「゜」は認めない。
const KANA_PATTERN = /^[ぁ-ゖー　 ]+$/u;

// 半角数字のみ
const PHONE_PATTERN = /^[0-9]+$/;

export function isKana(value: string): boolean {
  return KANA_PATTERN.test(value);
}

export type TextRule = {
  // 項目名（エラーメッセージの {項目名}）
  label: string;
  required?: boolean;
  max?: number;
  kana?: boolean;
};

// 文字の入力欄を確かめる。エラーがなければ空の配列
export function validateText(value: string, rule: TextRule): string[] {
  if (isEmpty(value)) {
    return rule.required ? [requiredMessage(rule.label)] : [];
  }
  const errors: string[] = [];
  if (rule.kana && !isKana(value)) {
    errors.push(kanaMessage(rule.label));
  }
  if (rule.max !== undefined && countChars(value) > rule.max) {
    errors.push(maxLengthMessage(rule.label, rule.max));
  }
  return errors;
}

// 電話番号を確かめる。emptyMessage は空のときのメッセージ（任意の欄なら null）。エラーがなければ空の配列
// - 担当者（F-07）：必須 →「電話番号は必須です」
// - 取次メモ（F-02）：用件が「折り返し希望」のときだけ必須 →「折り返し希望の場合、電話番号は必須です」
// 全角数字やハイフンは自動で変換しない。
export function validatePhone(value: string, emptyMessage: string | null): string[] {
  if (isEmpty(value)) {
    return emptyMessage === null ? [] : [emptyMessage];
  }
  if (!PHONE_PATTERN.test(value)) {
    return [PHONE_DIGITS_MESSAGE];
  }
  if (value.length > PHONE_MAX_DIGITS) {
    return [PHONE_LENGTH_MESSAGE];
  }
  return [];
}
