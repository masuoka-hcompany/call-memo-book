// 宛先ごとの取次可否の「保存」（S-06・S-08 で共通）で送られた値を、記録する変更に直す

import { isSettingValue, type SettingChange, type SettingValue, settingChanges } from "../domain/setting.ts";
import type { RecipientSetting } from "../repo/settings.ts";
import { settingFieldName } from "../views/SettingsSection.tsx";

// いま表示している宛先（削除されていない宛先）の値だけを読む。不正な値・知らない宛先は無視する
export function submittedSettingChanges(body: Record<string, unknown>, settings: RecipientSetting[]): SettingChange[] {
  const current = new Map<number, SettingValue>();
  const submitted = new Map<number, SettingValue>();
  for (const s of settings) {
    current.set(s.recipient.id, s.value);
    const value = body[settingFieldName(s.recipient.id)];
    if (isSettingValue(value)) submitted.set(s.recipient.id, value);
  }
  return settingChanges(current, submitted);
}
