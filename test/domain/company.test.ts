import { describe, expect, it } from "vitest";
import {
  compareByKana,
  matchesCompanyKeyword,
  normalizeKeyword,
  validateCompanyInput,
} from "../../src/domain/company.ts";

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

describe("validateCompanyInput（S-07 の入力チェック）", () => {
  const input = (v: Partial<{ name: string; kana: string; memo: string }>) => ({ name: "", kana: "", memo: "", ...v });

  it("会社名とよみがなを入れれば保存できる", () => {
    expect(validateCompanyInput(input({ name: "マイナビ", kana: "まいなび" }))).toEqual({
      ok: true,
      values: { name: "マイナビ", kana: "まいなび", memo: "" },
    });
  });

  it("AC-55：何も入力しないと、よみがなだけ必須のエラー（会社名は任意）", () => {
    expect(validateCompanyInput(input({}))).toEqual({
      ok: false,
      values: { name: "", kana: "", memo: "" },
      errors: { kana: ["会社名のよみがなは必須です"] },
    });
  });

  it("AC-68：会社名が空でも、よみがながあれば保存できる", () => {
    expect(validateCompanyInput(input({ kana: "みいだす" })).ok).toBe(true);
  });

  it("AC-23：よみがながカタカナならエラー", () => {
    const r = validateCompanyInput(input({ name: "マイナビ", kana: "マイナビ" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toEqual({ kana: ["会社名のよみがなはひらがなで入力してください"] });
  });

  it("AC-56：会社名が256文字ならエラー、255文字なら保存できる", () => {
    const r = validateCompanyInput(input({ name: "あ".repeat(256), kana: "てすと" }));
    expect(!r.ok && r.errors).toEqual({ name: ["会社名は255文字以内で入力してください"] });
    expect(validateCompanyInput(input({ name: "あ".repeat(255), kana: "てすと" })).ok).toBe(true);
  });

  it("よみがなが256文字ならエラー、255文字なら保存できる", () => {
    const r = validateCompanyInput(input({ kana: "あ".repeat(256) }));
    expect(!r.ok && r.errors).toEqual({ kana: ["会社名のよみがなは255文字以内で入力してください"] });
    expect(validateCompanyInput(input({ kana: "あ".repeat(255) })).ok).toBe(true);
  });

  it("メモが1,001文字ならエラー、1,000文字なら保存できる", () => {
    const r = validateCompanyInput(input({ kana: "てすと", memo: "あ".repeat(1001) }));
    expect(!r.ok && r.errors).toEqual({ memo: ["メモは1,000文字以内で入力してください"] });
    expect(validateCompanyInput(input({ kana: "てすと", memo: "あ".repeat(1000) })).ok).toBe(true);
  });

  it("複数の欄のエラーを同時に返し、1つの欄の複数のエラーもすべて返す（Q-M09）", () => {
    const r = validateCompanyInput(input({ name: "あ".repeat(256), kana: "ア".repeat(256) }));
    expect(!r.ok && r.errors).toEqual({
      name: ["会社名は255文字以内で入力してください"],
      kana: ["会社名のよみがなはひらがなで入力してください", "会社名のよみがなは255文字以内で入力してください"],
    });
  });

  it("会社名・よみがなは前後の空白を削る。メモは削らない（Q-M11）", () => {
    const r = validateCompanyInput(input({ name: "　マイナビ ", kana: " まいなび\t", memo: "  採用媒体\n" }));
    expect(r).toEqual({ ok: true, values: { name: "マイナビ", kana: "まいなび", memo: "  採用媒体\n" } });
  });

  it("前後の空白を削ってから文字数を数える（前後の空白を含めて256文字でも、削って255文字なら保存できる）", () => {
    expect(validateCompanyInput(input({ name: ` ${"あ".repeat(255)}`, kana: "てすと" })).ok).toBe(true);
  });

  it("よみがなが空白だけなら必須のエラー（Q-M07）", () => {
    const r = validateCompanyInput(input({ kana: "　 " }));
    expect(!r.ok && r.errors).toEqual({ kana: ["会社名のよみがなは必須です"] });
  });

  it("メモが空白・改行だけでも保存できる（任意の欄）", () => {
    expect(validateCompanyInput(input({ kana: "てすと", memo: "\n\n" })).ok).toBe(true);
  });

  it("よみがなに長音・半角スペースを含めてよい（Q-M08）", () => {
    expect(validateCompanyInput(input({ kana: "らーめん はうす" })).ok).toBe(true);
  });
});
