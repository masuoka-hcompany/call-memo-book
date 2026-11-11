// 会社一覧（S-05）の検索と並び順（仕様書 F-06）

import { isEmpty } from "./text.ts";

type CompanyLike = { id: number; name: string; kana: string };

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
