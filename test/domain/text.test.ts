import { describe, expect, it } from "vitest";
import {
  countChars,
  displayName,
  formatNumber,
  isEmpty,
  normalizeNewlines,
  trimSingleLine,
} from "../../src/domain/text.ts";
import { NAME_MAX, validatePhone, validateText } from "../../src/domain/validation.ts";

describe("trimSingleLine（1行の欄の前後の空白を削る。Q-M11）", () => {
  it("前後の半角・全角スペース、タブ、改行を削る", () => {
    expect(trimSingleLine(" はらだ ")).toBe("はらだ");
    expect(trimSingleLine("　はらだ　")).toBe("はらだ");
    expect(trimSingleLine("\tはらだ\r\n")).toBe("はらだ");
  });

  it("間の空白は残す", () => {
    expect(trimSingleLine(" はらだ　いちろう ")).toBe("はらだ　いちろう");
    expect(trimSingleLine("はらだ いちろう")).toBe("はらだ いちろう");
  });

  it("空白だけなら空文字になる", () => {
    expect(trimSingleLine(" 　\t")).toBe("");
  });

  it("削ったあとの値で文字数を数える（前後の空白を含めて256文字でも、削って255文字ならエラーなし）", () => {
    const value = ` ${"あ".repeat(255)}`;
    expect(validateText(trimSingleLine(value), { label: "会社名", max: NAME_MAX })).toEqual([]);
  });

  it("電話番号の前後の空白を削ったあとはエラーにならない（全角数字・ハイフンは変換しない）", () => {
    expect(validatePhone(trimSingleLine("0312345678 "), null)).toEqual([]);
    expect(validatePhone(trimSingleLine(" 03-1234-5678 "), null)).toEqual(["電話番号は半角数字のみで入力してください"]);
  });
});

describe("countChars（文字数の数え方）", () => {
  it("全角・半角を区別せず1文字と数える", () => {
    expect(countChars("abc")).toBe(3);
    expect(countChars("あいう")).toBe(3);
    expect(countChars("ｱｲｳ")).toBe(3);
    expect(countChars("ａ1あ")).toBe(3);
  });

  it("サロゲートペア（𠮷・絵文字）もコードポイント数で1文字と数える", () => {
    expect("𠮷".length).toBe(2);
    expect(countChars("𠮷")).toBe(1);
    expect(countChars("😀a")).toBe(2);
  });

  it("改行は CRLF・CR・LF のどれでも1文字と数える（仮。Q-M06）", () => {
    expect(countChars("a\r\nb")).toBe(3);
    expect(countChars("a\rb")).toBe(3);
    expect(countChars("a\nb")).toBe(3);
  });

  it("空文字は0文字", () => {
    expect(countChars("")).toBe(0);
  });
});

describe("normalizeNewlines", () => {
  it("CRLF と CR を LF にそろえる", () => {
    expect(normalizeNewlines("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });
});

describe("isEmpty（空の判定）", () => {
  it("空文字は空", () => {
    expect(isEmpty("")).toBe(true);
  });

  it("半角・全角スペースだけの入力も空とみなす（Q-M07）", () => {
    expect(isEmpty(" ")).toBe(true);
    expect(isEmpty("　")).toBe(true);
    expect(isEmpty(" 　 　")).toBe(true);
  });

  it("スペース以外の文字があれば空ではない", () => {
    expect(isEmpty("　あ　")).toBe(false);
  });

  it("タブ・改行だけの入力も空とみなす（Q-M07）", () => {
    expect(isEmpty("\t")).toBe(true);
    expect(isEmpty("\r\n")).toBe(true);
    expect(isEmpty("\n\n　\t ")).toBe(true);
  });

  it("改行をはさんで文字があれば空ではない", () => {
    expect(isEmpty("\nあ\n")).toBe(false);
  });
});

describe("formatNumber", () => {
  it("カンマ区切りにする", () => {
    expect(formatNumber(255)).toBe("255");
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});

describe("displayName（名前が空ならよみがな）", () => {
  it("名前があれば名前", () => {
    expect(displayName("マイナビ", "まいなび")).toBe("マイナビ");
  });

  it("名前が空ならよみがな", () => {
    expect(displayName("", "みいだす")).toBe("みいだす");
  });

  it("スペースだけの名前は空とみなし、よみがなを表示する（Q-M07）", () => {
    expect(displayName("　", "みいだす")).toBe("みいだす");
    expect(displayName(" ", "みいだす")).toBe("みいだす");
  });
});
