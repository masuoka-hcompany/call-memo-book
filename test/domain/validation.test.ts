import { describe, expect, it } from "vitest";
import {
  CALLBACK_PHONE_REQUIRED_MESSAGE,
  kanaMessage,
  maxLengthMessage,
  PHONE_DIGITS_MESSAGE,
  PHONE_LENGTH_MESSAGE,
  requiredMessage,
} from "../../src/domain/messages.ts";
import { isKana, LONG_TEXT_MAX, NAME_MAX, validatePhone, validateText } from "../../src/domain/validation.ts";

const chars = (n: number, c = "あ") => c.repeat(n);

describe("エラーメッセージの文言（仕様書 6章）", () => {
  it("必須", () => {
    expect(requiredMessage("会社名")).toBe("会社名は必須です");
    expect(requiredMessage("会社名のよみがな")).toBe("会社名のよみがなは必須です");
    expect(requiredMessage("担当者名のよみがな")).toBe("担当者名のよみがなは必須です");
    expect(requiredMessage("電話番号")).toBe("電話番号は必須です");
    expect(requiredMessage("宛先")).toBe("宛先は必須です");
    expect(requiredMessage("受電日時")).toBe("受電日時は必須です");
    expect(requiredMessage("用件")).toBe("用件は必須です");
  });

  it("文字数の上限（1,000 はカンマ区切り）", () => {
    expect(maxLengthMessage("会社名", 255)).toBe("会社名は255文字以内で入力してください");
    expect(maxLengthMessage("伝言", 1000)).toBe("伝言は1,000文字以内で入力してください");
  });

  it("よみがな", () => {
    expect(kanaMessage("会社名のよみがな")).toBe("会社名のよみがなはひらがなで入力してください");
    expect(kanaMessage("担当者名のよみがな")).toBe("担当者名のよみがなはひらがなで入力してください");
  });

  it("電話番号", () => {
    expect(PHONE_DIGITS_MESSAGE).toBe("電話番号は半角数字のみで入力してください");
    expect(PHONE_LENGTH_MESSAGE).toBe("電話番号は15桁以内で入力してください");
    expect(CALLBACK_PHONE_REQUIRED_MESSAGE).toBe("折り返し希望の場合、電話番号は必須です");
  });
});

describe("validateText", () => {
  const companyName = { label: "会社名", max: NAME_MAX };
  const memoMessage = { label: "伝言", max: LONG_TEXT_MAX };
  const companyKana = { label: "会社名のよみがな", required: true, max: NAME_MAX, kana: true };

  it("255文字ならエラーなし、256文字ならエラー", () => {
    expect(validateText(chars(255), companyName)).toBeNull();
    expect(validateText(chars(256), companyName)).toBe("会社名は255文字以内で入力してください");
  });

  it("半角でも全角と同じ1文字と数える（255／256文字）", () => {
    expect(validateText(chars(255, "a"), companyName)).toBeNull();
    expect(validateText(chars(256, "a"), companyName)).toBe("会社名は255文字以内で入力してください");
  });

  it("1,000文字ならエラーなし、1,001文字ならエラー", () => {
    expect(validateText(chars(1000), memoMessage)).toBeNull();
    expect(validateText(chars(1001), memoMessage)).toBe("伝言は1,000文字以内で入力してください");
  });

  it("改行（CRLF）を含む1,000文字はエラーなし（改行を1文字と数える。仮。Q-M06）", () => {
    const value = `${chars(499)}\r\n${chars(500)}`;
    expect(value.length).toBe(1001);
    expect(validateText(value, memoMessage)).toBeNull();
  });

  it("必須の欄が空なら「{項目名}は必須です」", () => {
    expect(validateText("", companyKana)).toBe("会社名のよみがなは必須です");
  });

  it("任意の欄が空ならエラーなし", () => {
    expect(validateText("", companyName)).toBeNull();
  });

  it("よみがなにひらがな以外が含まれるとエラー", () => {
    expect(validateText("まいなび", companyKana)).toBeNull();
    expect(validateText("マイナビ", companyKana)).toBe("会社名のよみがなはひらがなで入力してください");
  });

  it("よみがなが255文字ならエラーなし、256文字ならエラー", () => {
    expect(validateText(chars(255), companyKana)).toBeNull();
    expect(validateText(chars(256), companyKana)).toBe("会社名のよみがなは255文字以内で入力してください");
  });

  it("1つの欄に複数のエラーがあるときは、形式のエラーを先に1つだけ返す（仮。Q-M09）", () => {
    expect(validateText(chars(256, "ア"), companyKana)).toBe("会社名のよみがなはひらがなで入力してください");
  });
});

describe("isKana（よみがなに使える文字）", () => {
  it("ひらがなと全角スペースは使える", () => {
    expect(isKana("はらだ")).toBe(true);
    expect(isKana("はらだ　いちろう")).toBe(true);
    expect(isKana("ぁぃぅゃゅょっ")).toBe(true);
    expect(isKana("ゔゕゖ")).toBe(true);
  });

  it("カタカナ・漢字・英数字・半角スペースは使えない", () => {
    expect(isKana("ハラダ")).toBe(false);
    expect(isKana("原田")).toBe(false);
    expect(isKana("harada")).toBe(false);
    expect(isKana("はらだ いちろう")).toBe(false);
    expect(isKana("ﾊﾗﾀﾞ")).toBe(false);
  });

  it("長音「ー」・踊り字「ゝ」「ゞ」・濁点の記号は使えない（仮。Q-M08）", () => {
    expect(isKana("らーめん")).toBe(false);
    expect(isKana("いすゞ")).toBe(false);
    expect(isKana("ゝ")).toBe(false);
    expect(isKana("゛")).toBe(false);
  });

  it("空文字は使えない（必須チェックは別に行う）", () => {
    expect(isKana("")).toBe(false);
  });
});

describe("validatePhone", () => {
  it("15桁ならエラーなし、16桁ならエラー", () => {
    expect(validatePhone("012345678901234", null)).toBeNull();
    expect(validatePhone("0123456789012345", null)).toBe("電話番号は15桁以内で入力してください");
  });

  it("ハイフンを含むとエラー（自動で取り除かない）", () => {
    expect(validatePhone("03-1234-5678", null)).toBe("電話番号は半角数字のみで入力してください");
  });

  it("全角数字はエラー（自動で変換しない）", () => {
    expect(validatePhone("０３１２３４５６７８", null)).toBe("電話番号は半角数字のみで入力してください");
  });

  it("空白を含むとエラー", () => {
    expect(validatePhone("0312345678 ", null)).toBe("電話番号は半角数字のみで入力してください");
  });

  it("任意の欄（取次メモで用件が折り返し希望以外）が空ならエラーなし", () => {
    expect(validatePhone("", null)).toBeNull();
  });

  it("担当者の電話番号（必須）が空なら「電話番号は必須です」", () => {
    expect(validatePhone("", requiredMessage("電話番号"))).toBe("電話番号は必須です");
  });

  it("用件が折り返し希望で空なら「折り返し希望の場合、電話番号は必須です」", () => {
    expect(validatePhone("", CALLBACK_PHONE_REQUIRED_MESSAGE)).toBe("折り返し希望の場合、電話番号は必須です");
  });

  it("半角数字以外を含み16桁以上のときは、半角数字のエラーを1つだけ返す（仮。Q-M09）", () => {
    expect(validatePhone("0123-4567-8901-2345", null)).toBe("電話番号は半角数字のみで入力してください");
  });
});
