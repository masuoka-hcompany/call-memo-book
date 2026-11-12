// 相手の検索のルール（仕様書 F-01）：S-01 相手検索

import { compareByKana } from "./company.ts";
import { isEmpty } from "./text.ts";

type CompanyLike = { id: number; name: string; kana: string; deleted: boolean };
type ContactLike = { id: number; companyId: number; name: string; kana: string; phone: string; deleted: boolean };

// 検索結果の1行。担当者ごとに1行。担当者が登録されていない会社は、会社だけの行（contact が null）
export type PartyRow<C extends CompanyLike, P extends ContactLike> = { company: C; contact: P | null };

// 検索するか。検索欄が空のまま検索した場合は、検索しない（F-01・AC-35）。
// 空白だけの入力も空とみなす（仮。docs/questions.md Q-M26）
export function shouldSearch(keyword: string): boolean {
  return !isEmpty(keyword);
}

// 会社名、会社名のよみがな、担当者名、担当者名のよみがな、電話番号のいずれかに部分一致する相手を返す。
// - 入力どおりに比べる（ひらがなとカタカナ、全角と半角を同じものとして扱わない。前後の空白も削らない。仮。Q-M26）
// - 会社名（よみがな）に一致した会社は、担当者全員を返す。担当者が0人の会社は会社だけの行にする
// - 削除された会社・担当者は返さない
// - 並び順は指定なし（仕様書 F-01）。モックでは会社のよみがな順、同じ会社の担当者は登録順にする
// 検索しない入力（shouldSearch が false）なら空の配列
export function searchParties<C extends CompanyLike, P extends ContactLike>(
  companies: C[],
  contacts: P[],
  keyword: string,
): PartyRow<C, P>[] {
  if (!shouldSearch(keyword)) return [];
  const rows: PartyRow<C, P>[] = [];
  for (const company of companies.filter((c) => !c.deleted).sort(compareByKana)) {
    const members = contacts.filter((p) => p.companyId === company.id && !p.deleted).sort((a, b) => a.id - b.id);
    const companyMatched = company.name.includes(keyword) || company.kana.includes(keyword);
    if (members.length === 0) {
      if (companyMatched) rows.push({ company, contact: null });
      continue;
    }
    for (const contact of members) {
      const contactMatched =
        contact.name.includes(keyword) || contact.kana.includes(keyword) || contact.phone.includes(keyword);
      if (companyMatched || contactMatched) rows.push({ company, contact });
    }
  }
  return rows;
}
