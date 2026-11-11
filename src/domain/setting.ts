// 取次可否と優先ルール（仕様書 3章・F-08・8.2）

export const SETTING_VALUES = ["connect", "decline", "unset"] as const;
export type SettingValue = (typeof SETTING_VALUES)[number];

// 画面の表記（仕様書 3章）
export const SETTING_LABELS: Record<SettingValue, string> = {
  connect: "つなぐ",
  decline: "つながない",
  unset: "未設定",
};

export function isSettingValue(value: unknown): value is SettingValue {
  return typeof value === "string" && (SETTING_VALUES as readonly string[]).includes(value);
}

export type ResolvedSetting = {
  // 採用される値
  value: SettingValue;
  // どちらの値を採用したか
  source: "contact" | "company";
};

// 優先ルール：担当者の取次可否が「未設定」以外ならそれを採用し、「未設定」なら会社の取次可否を採用する。
// contact が null のときは、担当者のいない会社の行（会社の取次可否だけを表示する。F-01）。
export function resolveSetting(contact: SettingValue | null, company: SettingValue): ResolvedSetting {
  if (contact !== null && contact !== "unset") {
    return { value: contact, source: "contact" };
  }
  return { value: company, source: "company" };
}
