import { describe, expect, it } from "vitest";
import { compareByKana, matchesCompanyKeyword, normalizeKeyword } from "../../src/domain/company.ts";

const mynavi = { id: 1, name: "マイナビ", kana: "まいなび" };
const miidas = { id: 2, name: "ミイダス", kana: "みいだす" };
const noName = { id: 3, name: "", kana: "やまびこでんき" };

describe("matchesCompanyKeyword（会社名・よみがなの部分一致）", () => {
  it("よみがなの部分一致（AC-57：「まい」で「マイナビ」だけ）", () => {
    expect(matchesCompanyKeyword(mynavi, "まい")).toBe(true);
    expect(matchesCompanyKeyword(miidas, "まい")).toBe(false);
  });

  it("会社名の部分一致", () => {
    expect(matchesCompanyKeyword(mynavi, "ナビ")).toBe(true);
    expect(matchesCompanyKeyword(miidas, "ナビ")).toBe(false);
  });

  it("入力どおりに比べる（ひらがなとカタカナ、全角と半角を同じものとして扱わない）", () => {
    expect(matchesCompanyKeyword(mynavi, "まいなび")).toBe(true);
    expect(matchesCompanyKeyword({ ...mynavi, name: "" }, "マイ")).toBe(false);
    expect(matchesCompanyKeyword(mynavi, "ﾏｲ")).toBe(false);
    expect(matchesCompanyKeyword({ id: 9, name: "ABC商事", kana: "えーびーしー" }, "ａｂｃ")).toBe(false);
  });

  it("会社名が空の会社も、よみがなで当たる", () => {
    expect(matchesCompanyKeyword(noName, "やまびこ")).toBe(true);
  });

  it("キーワードが空・空白だけなら、すべての会社が当てはまる（仮。Q-M12）", () => {
    expect(matchesCompanyKeyword(mynavi, "")).toBe(true);
    expect(matchesCompanyKeyword(mynavi, "　 ")).toBe(true);
  });

  it("前後の空白も入力どおりに比べる", () => {
    expect(matchesCompanyKeyword(mynavi, " まい")).toBe(false);
  });
});

describe("normalizeKeyword", () => {
  it("空白だけなら空文字、それ以外はそのまま", () => {
    expect(normalizeKeyword("　")).toBe("");
    expect(normalizeKeyword(" まい ")).toBe(" まい ");
  });
});

describe("compareByKana（よみがな順）", () => {
  const sort = (rows: { id: number; name: string; kana: string }[]) => [...rows].sort(compareByKana).map((r) => r.id);

  it("AC-58：登録順が ミイダス→マイナビ でも、よみがな順で マイナビ→ミイダス", () => {
    expect(
      sort([
        { ...miidas, id: 1 },
        { ...mynavi, id: 2 },
      ]),
    ).toEqual([2, 1]);
  });

  it("五十音順（会社名ではなくよみがなで並べる）", () => {
    const rows = [
      { id: 1, name: "A", kana: "わだ" },
      { id: 2, name: "B", kana: "あおば" },
      { id: 3, name: "C", kana: "さくら" },
      { id: 4, name: "D", kana: "かとう" },
    ];
    expect(sort(rows)).toEqual([2, 4, 3, 1]);
  });

  it("前方一致するよみがなは短い方が先", () => {
    expect(
      sort([
        { id: 1, name: "", kana: "まいなびと" },
        { id: 2, name: "", kana: "まいなび" },
      ]),
    ).toEqual([2, 1]);
  });

  it("濁音は清音のすぐ後（か→が→き）", () => {
    const rows = [
      { id: 1, name: "", kana: "き" },
      { id: 2, name: "", kana: "が" },
      { id: 3, name: "", kana: "か" },
    ];
    expect(sort(rows)).toEqual([3, 2, 1]);
  });

  it("よみがなが同じなら登録順（ID の小さい順。仮。Q-M14）", () => {
    const rows = [
      { id: 5, name: "東和建設", kana: "とうわけんせつ" },
      { id: 2, name: "東和建設", kana: "とうわけんせつ" },
    ];
    expect(sort(rows)).toEqual([2, 5]);
  });
});
