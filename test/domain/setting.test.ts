import { describe, expect, it } from "vitest";
import { isSettingValue, resolveSetting, SETTING_LABELS, type SettingValue } from "../../src/domain/setting.ts";

describe("SETTING_LABELS（画面の表記）", () => {
  it("つなぐ／つながない／未設定", () => {
    expect(SETTING_LABELS).toEqual({ connect: "つなぐ", decline: "つながない", unset: "未設定" });
  });
});

describe("resolveSetting（優先ルール）", () => {
  const values: SettingValue[] = ["connect", "decline", "unset"];

  // 担当者が「未設定」× 会社の値
  it.each(values)("担当者が未設定なら、会社の値（%s）を採用する", (company) => {
    expect(resolveSetting("unset", company)).toEqual({ value: company, source: "company" });
  });

  // 担当者が「未設定」以外 × 会社の値
  for (const contact of ["connect", "decline"] as const) {
    it.each(values)(`担当者が ${contact} なら、会社の値（%s）にかかわらず担当者を採用する`, (company) => {
      expect(resolveSetting(contact, company)).toEqual({ value: contact, source: "contact" });
    });
  }

  it("担当者のいない会社の行（担当者 null）は、会社の値を採用する", () => {
    for (const company of values) {
      expect(resolveSetting(null, company)).toEqual({ value: company, source: "company" });
    }
  });

  it("AC-03 の組み合わせ：会社「未設定」・担当者「つながない」は担当者の「つながない」", () => {
    expect(resolveSetting("decline", "unset")).toEqual({ value: "decline", source: "contact" });
  });
});

describe("isSettingValue", () => {
  it("3つの値だけを受け付ける", () => {
    expect(isSettingValue("connect")).toBe(true);
    expect(isSettingValue("decline")).toBe(true);
    expect(isSettingValue("unset")).toBe(true);
    expect(isSettingValue("つなぐ")).toBe(false);
    expect(isSettingValue(undefined)).toBe(false);
  });
});
