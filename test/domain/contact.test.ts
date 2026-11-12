import { describe, expect, it } from "vitest";
import { CONTACT_FIELD_LABELS, type ContactInput, validateContactInput } from "../../src/domain/contact.ts";

const input = (v: Partial<ContactInput>): ContactInput => ({ name: "", kana: "", phone: "", memo: "", ...v });
const ok = (v: Partial<ContactInput>) => input({ name: "原田", kana: "はらだ", phone: "0312345678", ...v });
const errorsOf = (v: ContactInput) => {
  const r = validateContactInput(v);
  return r.ok ? {} : r.errors;
};

describe("CONTACT_FIELD_LABELS（項目名＝エラーメッセージの {項目名}）", () => {
  it("仕様書 7.1・F-07 のとおり", () => {
    expect(CONTACT_FIELD_LABELS).toEqual({
      name: "担当者名",
      kana: "担当者名のよみがな",
      phone: "電話番号",
      memo: "メモ",
    });
  });
});

describe("validateContactInput（S-09 の入力チェック）", () => {
  it("AC-25：担当者名・よみがな・電話番号を入れれば保存できる", () => {
    expect(validateContactInput(ok({}))).toEqual({
      ok: true,
      values: { name: "原田", kana: "はらだ", phone: "0312345678", memo: "" },
    });
  });

  it("AC-59：何も入力しないと、よみがなと電話番号に必須のエラー（担当者名・メモは任意）", () => {
    expect(validateContactInput(input({}))).toEqual({
      ok: false,
      values: { name: "", kana: "", phone: "", memo: "" },
      errors: { kana: ["担当者名のよみがなは必須です"], phone: ["電話番号は必須です"] },
    });
  });

  it("AC-69：担当者名が空でも、よみがなと電話番号があれば保存できる", () => {
    expect(validateContactInput(ok({ name: "" })).ok).toBe(true);
  });

  it("AC-60：よみがながカタカナならエラー", () => {
    expect(errorsOf(ok({ kana: "ハラダ" }))).toEqual({ kana: ["担当者名のよみがなはひらがなで入力してください"] });
  });

  it("AC-26：電話番号にハイフンを含むとエラー（自動で変換しない）", () => {
    expect(errorsOf(ok({ phone: "03-1234-5678" }))).toEqual({ phone: ["電話番号は半角数字のみで入力してください"] });
  });

  it("電話番号に全角数字を含むとエラー（自動で変換しない）", () => {
    expect(errorsOf(ok({ phone: "０３１２３４５６７８" }))).toEqual({
      phone: ["電話番号は半角数字のみで入力してください"],
    });
  });

  it("AC-66・AC-67：電話番号は15桁なら保存でき、16桁ならエラー", () => {
    expect(validateContactInput(ok({ phone: "012345678901234" })).ok).toBe(true);
    expect(errorsOf(ok({ phone: "0123456789012345" }))).toEqual({ phone: ["電話番号は15桁以内で入力してください"] });
  });

  it("電話番号が半角数字以外を含み16桁以上でも、「半角数字のみ」のエラーだけ（Q-M09）", () => {
    expect(errorsOf(ok({ phone: "0123-4567-8901-2345" }))).toEqual({
      phone: ["電話番号は半角数字のみで入力してください"],
    });
  });

  it("担当者名は255文字なら保存でき、256文字ならエラー", () => {
    expect(validateContactInput(ok({ name: "あ".repeat(255) })).ok).toBe(true);
    expect(errorsOf(ok({ name: "あ".repeat(256) }))).toEqual({ name: ["担当者名は255文字以内で入力してください"] });
  });

  it("よみがなは255文字なら保存でき、256文字ならエラー", () => {
    expect(validateContactInput(ok({ kana: "あ".repeat(255) })).ok).toBe(true);
    expect(errorsOf(ok({ kana: "あ".repeat(256) }))).toEqual({
      kana: ["担当者名のよみがなは255文字以内で入力してください"],
    });
  });

  it("メモは1,000文字なら保存でき、1,001文字ならエラー", () => {
    expect(validateContactInput(ok({ memo: "あ".repeat(1000) })).ok).toBe(true);
    expect(errorsOf(ok({ memo: "あ".repeat(1001) }))).toEqual({ memo: ["メモは1,000文字以内で入力してください"] });
  });

  it("複数の欄のエラーを同時に返し、1つの欄の複数のエラーもすべて返す（Q-M09）", () => {
    expect(errorsOf(input({ name: "あ".repeat(256), kana: "ア".repeat(256), phone: "03-1234-5678" }))).toEqual({
      name: ["担当者名は255文字以内で入力してください"],
      kana: ["担当者名のよみがなはひらがなで入力してください", "担当者名のよみがなは255文字以内で入力してください"],
      phone: ["電話番号は半角数字のみで入力してください"],
    });
  });

  it("担当者名・よみがな・電話番号は前後の空白を削る。メモは削らない（Q-M11）", () => {
    expect(
      validateContactInput(input({ name: "　原田 ", kana: " はらだ\t", phone: " 0312345678　", memo: " 総務\n" })),
    ).toEqual({ ok: true, values: { name: "原田", kana: "はらだ", phone: "0312345678", memo: " 総務\n" } });
  });

  it("前後の空白を削ってから桁数を数える（空白を含めて16文字でも、削って15桁なら保存できる）", () => {
    expect(validateContactInput(ok({ phone: " 012345678901234" })).ok).toBe(true);
  });

  it("間に空白がある電話番号はエラー", () => {
    expect(errorsOf(ok({ phone: "03 1234 5678" }))).toEqual({ phone: ["電話番号は半角数字のみで入力してください"] });
  });

  it("よみがな・電話番号が空白だけなら必須のエラー（Q-M07）", () => {
    expect(errorsOf(input({ kana: "　 ", phone: " " }))).toEqual({
      kana: ["担当者名のよみがなは必須です"],
      phone: ["電話番号は必須です"],
    });
  });

  it("よみがなに長音・半角スペースを含めてよい（Q-M08）", () => {
    expect(validateContactInput(ok({ kana: "じょー すみす" })).ok).toBe(true);
  });
});
