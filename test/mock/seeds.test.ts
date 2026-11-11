// シードのデータが仕様のルールを満たしているか（入力チェックを通る値だけでできているか）

import { describe, expect, it } from "vitest";
import { CALLBACK_PHONE_REQUIRED_MESSAGE, requiredMessage } from "../../src/domain/messages.ts";
import { LONG_TEXT_MAX, NAME_MAX, validatePhone, validateText } from "../../src/domain/validation.ts";
import { buildDefaultData, buildDemoData } from "../../src/mock/seeds.ts";

describe("共通の前提（/__seed/default）", () => {
  it("利用者3人・宛先2人で、会社・担当者・取次メモは0件", () => {
    const d = buildDefaultData();
    expect(d.users.map((u) => u.name)).toEqual(["菊地", "益岡", "木村"]);
    expect(d.recipients.map((r) => r.displayName)).toEqual(["菊地", "社長"]);
    // 宛先「菊地」は利用者「菊地」と同じメールアドレス
    expect(d.recipients[0]?.email).toBe(d.users[0]?.email);
    expect(d.companies).toEqual([]);
    expect(d.contacts).toEqual([]);
    expect(d.memos).toEqual([]);
  });

  it("呼ぶたびに別のオブジェクトを返す", () => {
    const a = buildDefaultData();
    for (const u of a.users) u.name = "変更";
    expect(buildDefaultData().users[0]?.name).toBe("菊地");
  });
});

describe("デモデータ（/__seed/demo）", () => {
  const d = buildDemoData();

  it("見どころを含む", () => {
    const live = d.companies.filter((c) => !c.deleted);
    expect(live.length).toBe(10);
    // 同じ会社名の別の会社
    expect(live.filter((c) => c.name === "東和建設")).toHaveLength(2);
    // 会社名が空の会社
    expect(live.some((c) => c.name === "")).toBe(true);
    // 担当者0人の会社
    expect(live.some((c) => !d.contacts.some((p) => p.companyId === c.id && !p.deleted))).toBe(true);
    // 未対処・対処済みの混在、2ページ目が出る件数
    const memos = d.memos.filter((m) => !m.deleted);
    expect(memos.length).toBeGreaterThan(50);
    expect(memos.some((m) => m.status === "open")).toBe(true);
    expect(memos.some((m) => m.status === "done")).toBe(true);
    // つなぐ／つながない／未設定の混在
    const values = new Set(d.companySettings.map((s) => s.value));
    expect(values).toEqual(new Set(["connect", "decline", "unset"]));
  });

  it("会社・担当者は入力チェックを通る値", () => {
    for (const c of d.companies) {
      expect(validateText(c.name, { label: "会社名", max: NAME_MAX })).toBeNull();
      expect(validateText(c.kana, { label: "会社名のよみがな", required: true, max: NAME_MAX, kana: true })).toBeNull();
    }
    for (const p of d.contacts) {
      expect(
        validateText(p.kana, { label: "担当者名のよみがな", required: true, max: NAME_MAX, kana: true }),
      ).toBeNull();
      expect(validatePhone(p.phone, requiredMessage("電話番号"))).toBeNull();
    }
  });

  it("取次メモは入力チェックを通る値で、対処済みには対処した人と日時がある", () => {
    for (const m of d.memos) {
      expect(validateText(m.companyName, { label: "会社名", required: true, max: NAME_MAX })).toBeNull();
      expect(validateText(m.message, { label: "伝言", max: LONG_TEXT_MAX })).toBeNull();
      expect(validatePhone(m.phone, m.purpose === "callback" ? CALLBACK_PHONE_REQUIRED_MESSAGE : null)).toBeNull();
      if (m.status === "done") {
        expect(m.doneBy).not.toBeNull();
        expect(m.doneAt).not.toBeNull();
      } else {
        expect(m.doneBy).toBeNull();
        expect(m.doneAt).toBeNull();
      }
    }
  });

  it("ID が重ならない", () => {
    for (const rows of [d.companies, d.contacts, d.memos]) {
      const ids = rows.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
