// 会社のルール（仕様書 F-06）：会社一覧（S-05）の検索と並び順、会社登録・編集（S-07）の入力チェック

import { isEmpty, trimSingleLine } from "./text.ts";
import { LONG_TEXT_MAX, NAME_MAX, validateText } from "./validation.ts";

type CompanyLike = { id: number; name: string; kana: string };

// ---------- S-05 会社一覧 ----------

// 検索キーワード。空白だけなら空（絞り込まない。仮。docs/questions.md Q-M12）。それ以外は入力どおりに比べる
export function normalizeKeyword(keyword: string): string {
  return isEmpty(keyword) ? "" : keyword;
}

// 会社名・よみがなに部分一致するか。入力どおりに比べる（ひらがなとカタカナ、全角と半角を同じものとして扱わない）。
// キーワードが空なら、すべての会社が当てはまる。
export function matchesCompanyKeyword(company: CompanyLike, keyword: string): boolean {
  const k = normalizeKeyword(keyword);
  if (k === "") return true;
  return company.name.includes(k) || company.kana.includes(k);
}

// よみがな順。よみがなの文字コード順（ひらがなは五十音順に並ぶ。濁音・半濁音は清音のすぐ後、小書き文字は前）。
// よみがなが同じときは登録順（ID の小さい順）（仮。docs/questions.md Q-M14）。
export function compareByKana(a: CompanyLike, b: CompanyLike): number {
  if (a.kana < b.kana) return -1;
  if (a.kana > b.kana) return 1;
  return a.id - b.id;
}

// ---------- S-07 会社登録・編集 ----------

// 入力欄の項目名（エラーメッセージの {項目名} と同じ）
export const COMPANY_FIELD_LABELS = {
  name: "会社名",
  kana: "会社名のよみがな",
  memo: "メモ",
} as const;

export type CompanyField = keyof typeof COMPANY_FIELD_LABELS;
export type CompanyInput = Record<CompanyField, string>;
export type FieldErrors<F extends string> = Partial<Record<F, string[]>>;

export type CompanyValidation =
  | { ok: true; values: CompanyInput }
  | { ok: false; values: CompanyInput; errors: FieldErrors<CompanyField> };

// 会社の入力を確かめる。会社名・よみがなは前後の空白を削ってから確かめ、削った値を返す。メモは入力どおり（Q-M11）
export function validateCompanyInput(input: CompanyInput): CompanyValidation {
  const values: CompanyInput = {
    name: trimSingleLine(input.name),
    kana: trimSingleLine(input.kana),
    memo: input.memo,
  };
  const L = COMPANY_FIELD_LABELS;
  const all: FieldErrors<CompanyField> = {
    name: validateText(values.name, { label: L.name, max: NAME_MAX }),
    kana: validateText(values.kana, { label: L.kana, required: true, max: NAME_MAX, kana: true }),
    memo: validateText(values.memo, { label: L.memo, max: LONG_TEXT_MAX }),
  };
  const errors = Object.fromEntries(
    Object.entries(all).filter(([, messages]) => messages && messages.length > 0),
  ) as FieldErrors<CompanyField>;
  return Object.keys(errors).length === 0 ? { ok: true, values } : { ok: false, values, errors };
}
