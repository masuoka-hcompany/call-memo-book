// S-01 の取次可否の表示（判定と内訳。docs/design.md 5章、【未決】Q-M01）
// 採用値は src/domain/setting.ts の resolveSetting で決める。ここでは計算しない。
// /__styleguide の見本もこの部品で表示する。

import { type ResolvedSetting, SETTING_LABELS, type SettingValue } from "../domain/setting.ts";

// 内訳の語（design.md 5.3。Q-M01 の案の一部）
export const VERDICT_LABELS = {
  contact: "担当者",
  company: "会社",
  adopted: "← 採用",
  separator: "　／　",
} as const;

// 判定：採用される値を、枠か塗りで表示する
export function Verdict({ value }: { value: SettingValue }) {
  if (value === "decline") return <span class="verdict verdict-ng">✕ {SETTING_LABELS.decline}</span>;
  if (value === "connect") return <span class="verdict verdict-ok">● {SETTING_LABELS.connect}</span>;
  return <span class="verdict verdict-unset">― {SETTING_LABELS.unset}</span>;
}

function Source({ label, value, adopted }: { label: string; value: SettingValue; adopted: boolean }) {
  const text = `${label}：${SETTING_LABELS[value]}`;
  return adopted ? <span class="source-adopted">{`${text} ${VERDICT_LABELS.adopted}`}</span> : <>{text}</>;
}

// 内訳：担当者と会社の取次可否を並べ、採用された方を太字と「← 採用」で示す。
// contact が null（担当者のいない会社の行）なら、会社の取次可否だけを出す（F-01・AC-46）
export function Breakdown({
  contact,
  company,
  resolved,
}: {
  contact: SettingValue | null;
  company: SettingValue;
  resolved: ResolvedSetting;
}) {
  const L = VERDICT_LABELS;
  if (contact === null) {
    return (
      <span class="source-value">
        {L.company}：{SETTING_LABELS[company]}
      </span>
    );
  }
  return (
    <span class="source-value">
      <Source label={L.contact} value={contact} adopted={resolved.source === "contact"} />
      {L.separator}
      <Source label={L.company} value={company} adopted={resolved.source === "company"} />
    </span>
  );
}
