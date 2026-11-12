import { describe, expect, it } from "vitest";
import {
  RECIPIENT_FIELD_LABELS,
  selectableUsers,
  validateNewRecipient,
  validateRecipientName,
} from "../../src/domain/recipient.ts";

const kikuchi = { id: 1, email: "kikuchi@example.com", name: "菊地" };
const masuoka = { id: 2, email: "masuoka@example.com", name: "益岡" };
const kimura = { id: 3, email: "kimura@example.com", name: "木村" };
const users = [kikuchi, masuoka, kimura];

describe("RECIPIENT_FIELD_LABELS（項目名＝エラーメッセージの {項目名}）", () => {
  it("仕様書 7.1・F-09 のとおり", () => {
    expect(RECIPIENT_FIELD_LABELS).toEqual({ userId: "利用者", displayName: "表示名" });
  });
});

describe("selectableUsers（追加のプルダウンに出す利用者）", () => {
  it("既に宛先になっている利用者を除く（メールアドレスで照合）", () => {
    const recipients = [
      { email: "kikuchi@example.com", deleted: false },
      { email: "shacho@example.com", deleted: false },
    ];
    expect(selectableUsers(users, recipients)).toEqual([masuoka, kimura]);
  });

  it("削除された宛先の利用者も除く（画面から再追加できない）", () => {
    const recipients = [{ email: "kimura@example.com", deleted: true }];
    expect(selectableUsers(users, recipients)).toEqual([kikuchi, masuoka]);
  });

  it("全員が宛先なら空", () => {
    expect(selectableUsers(users, users)).toEqual([]);
  });
});

describe("validateNewRecipient（追加の入力チェック）", () => {
  it("AC-29：プルダウンの利用者を選べば追加できる", () => {
    expect(validateNewRecipient("3", [masuoka, kimura])).toEqual({ ok: true, user: kimura });
  });

  it("選ばないと「利用者は必須です」", () => {
    expect(validateNewRecipient("", [masuoka, kimura])).toEqual({
      ok: false,
      errors: { userId: ["利用者は必須です"] },
    });
    expect(validateNewRecipient(" ", [masuoka, kimura])).toEqual({
      ok: false,
      errors: { userId: ["利用者は必須です"] },
    });
  });

  it("プルダウンにない利用者（既に宛先・存在しない）は選ばれていないとみなす（仮。Q-M25）", () => {
    expect(validateNewRecipient("1", [masuoka, kimura])).toEqual({
      ok: false,
      errors: { userId: ["利用者は必須です"] },
    });
    expect(validateNewRecipient("99", [masuoka, kimura]).ok).toBe(false);
    expect(validateNewRecipient("abc", [masuoka, kimura]).ok).toBe(false);
  });
});

describe("validateRecipientName（編集の入力チェック）", () => {
  it("AC-42：表示名を変えられる（全角の括弧も可）", () => {
    expect(validateRecipientName("木村（営業）")).toEqual({ ok: true, displayName: "木村（営業）" });
  });

  it("空・空白だけなら「表示名は必須です」（Q-M07）", () => {
    expect(validateRecipientName("")).toEqual({
      ok: false,
      displayName: "",
      errors: { displayName: ["表示名は必須です"] },
    });
    expect(validateRecipientName("　 ")).toEqual({
      ok: false,
      displayName: "",
      errors: { displayName: ["表示名は必須です"] },
    });
  });

  it("255文字なら保存でき、256文字なら「表示名は255文字以内で入力してください」", () => {
    expect(validateRecipientName("あ".repeat(255)).ok).toBe(true);
    expect(validateRecipientName("あ".repeat(256))).toMatchObject({
      ok: false,
      errors: { displayName: ["表示名は255文字以内で入力してください"] },
    });
  });

  it("前後の空白を削ってから確かめ、削った値を返す（Q-M11）", () => {
    expect(validateRecipientName(" 木村　")).toEqual({ ok: true, displayName: "木村" });
    expect(validateRecipientName(` ${"あ".repeat(255)} `).ok).toBe(true);
  });
});
