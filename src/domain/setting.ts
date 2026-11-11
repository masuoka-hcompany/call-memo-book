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

export type SettingChange = { recipientId: number; value: SettingValue };

// 「保存」で記録する取次可否：送られた値のうち、いまの値と違う宛先だけ（値を変えていない宛先の更新者・更新日時は変えない。
// 仮。docs/questions.md Q-M17）。いまの値がない宛先は「未設定」とみなす。
// current にない宛先（削除された宛先など）の値は無視する。
export function settingChanges(
  current: ReadonlyMap<number, SettingValue>,
  submitted: ReadonlyMap<number, SettingValue>,
): SettingChange[] {
  const changes: SettingChange[] = [];
  for (const [recipientId, value] of submitted) {
    if (!current.has(recipientId)) continue;
    if (current.get(recipientId) !== value) changes.push({ recipientId, value });
  }
  return changes;
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
