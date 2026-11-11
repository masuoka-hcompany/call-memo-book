import { describe, expect, it } from "vitest";
import { searchParties, shouldSearch } from "../../src/domain/search.ts";

const company = (id: number, name: string, kana: string, deleted = false) => ({ id, name, kana, deleted });
const contact = (id: number, companyId: number, name: string, kana: string, phone: string, deleted = false) => ({
  id,
  companyId,
  name,
  kana,
  phone,
  deleted,
});

const mynavi = company(1, "マイナビ", "まいなび");
const miidas = company(2, "ミイダス", "みいだす");
const harada = contact(1, 1, "原田", "はらだ", "0312345678");
const sato = contact(2, 1, "佐藤", "さとう", "0398765432");

// 行を「会社名／担当者名」で表す
const names = (rows: ReturnType<typeof searchParties>) =>
  rows.map((r) => (r.contact ? `${r.company.name}／${r.contact.name}` : r.company.name));

describe("shouldSearch", () => {
  it("AC-35：空のままなら検索しない。空白だけも検索しない（仮。Q-M26）", () => {
    expect(shouldSearch("")).toBe(false);
    expect(shouldSearch("　 ")).toBe(false);
    expect(shouldSearch("原")).toBe(true);
  });
});

describe("searchParties（相手の検索）", () => {
  const companies = [mynavi, miidas];
  const contacts = [harada, sato];

  it("AC-01：担当者名の部分一致", () => {
    expect(names(searchParties(companies, contacts, "原"))).toEqual(["マイナビ／原田"]);
  });

  it("担当者名のよみがなの部分一致", () => {
    expect(names(searchParties(companies, contacts, "さと"))).toEqual(["マイナビ／佐藤"]);
  });

  it("AC-44：電話番号の部分一致", () => {
    expect(names(searchParties(companies, contacts, "12345"))).toEqual(["マイナビ／原田"]);
  });

  it("AC-02・AC-45：会社名・会社名のよみがなに一致すると、その会社の担当者全員", () => {
    expect(names(searchParties(companies, contacts, "まいな"))).toEqual(["マイナビ／原田", "マイナビ／佐藤"]);
    expect(names(searchParties(companies, contacts, "マイナ"))).toEqual(["マイナビ／原田", "マイナビ／佐藤"]);
  });

  it("AC-46：担当者が0人の会社は、会社だけの行", () => {
    const rows = searchParties(companies, contacts, "ミイダス");
    expect(rows).toEqual([{ company: miidas, contact: null }]);
  });

  it("担当者だけに一致した会社には、会社だけの行を足さない", () => {
    expect(searchParties(companies, contacts, "原田").every((r) => r.contact !== null)).toBe(true);
  });

  it("AC-47：削除された担当者は表示しない", () => {
    const deleted = contact(1, 1, "原田", "はらだ", "0312345678", true);
    expect(names(searchParties(companies, [deleted, sato], "マイナ"))).toEqual(["マイナビ／佐藤"]);
    expect(searchParties(companies, [deleted, sato], "原田")).toEqual([]);
  });

  it("削除された会社は表示しない（担当者に一致しても出さない）", () => {
    const deletedCompany = company(1, "マイナビ", "まいなび", true);
    expect(searchParties([deletedCompany, miidas], contacts, "マイナ")).toEqual([]);
    expect(searchParties([deletedCompany, miidas], contacts, "原田")).toEqual([]);
  });

  it("担当者が全員削除された会社は、会社だけの行", () => {
    const deleted = [harada, sato].map((p) => ({ ...p, deleted: true }));
    expect(searchParties(companies, deleted, "マイナ")).toEqual([{ company: mynavi, contact: null }]);
  });

  it("AC-04：一致しなければ0件", () => {
    expect(searchParties([mynavi], [harada], "ミイダス")).toEqual([]);
  });

  it("AC-35：検索欄が空・空白だけなら0件（検索しない）", () => {
    expect(searchParties(companies, contacts, "")).toEqual([]);
    expect(searchParties(companies, contacts, " ")).toEqual([]);
  });

  it("入力どおりに比べる（ひらがなとカタカナ、全角と半角を同じものとして扱わない）", () => {
    expect(searchParties(companies, contacts, "マイナビ").length).toBe(2);
    expect(searchParties([company(1, "", "まいなび")], [], "マイナビ")).toEqual([]);
    expect(searchParties(companies, contacts, "ﾏｲﾅ")).toEqual([]);
    expect(searchParties(companies, contacts, "０３１２")).toEqual([]);
  });

  it("前後の空白も入力どおりに比べる（仮。Q-M26）", () => {
    expect(searchParties(companies, contacts, " 原田")).toEqual([]);
  });

  it("会社名が空の会社も、よみがなで当たる", () => {
    const noName = company(3, "", "やまびこでんき");
    expect(searchParties([noName], [], "やまびこ")).toEqual([{ company: noName, contact: null }]);
  });

  it("同じ会社名の別の会社は、別の行で返す（よみがな順、同じなら登録順）", () => {
    const towa1 = company(5, "東和建設", "とうわけんせつ");
    const towa2 = company(3, "東和建設", "とうわけんせつ");
    const rows = searchParties([towa1, towa2], [contact(9, 5, "山本", "やまもと", "0311112222")], "東和");
    expect(rows.map((r) => [r.company.id, r.contact?.id ?? null])).toEqual([
      [3, null],
      [5, 9],
    ]);
  });
});
