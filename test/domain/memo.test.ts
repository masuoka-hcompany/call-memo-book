import { describe, expect, it } from "vitest";
import { changeMemoStatus, MEMO_FIELD_LABELS, type MemoInput, validateMemoInput } from "../../src/domain/memo.ts";

const RECIPIENTS = [1, 2];
const empty: MemoInput = {
  recipientId: "",
  receivedAt: "",
  companyName: "",
  personName: "",
  phone: "",
  purpose: "",
  message: "",
  note: "",
};
// AC-08 などの共通の入力：宛先「菊地」、会社名「マイナビ」、用件「伝言希望」
const base = (v: Partial<MemoInput> = {}): MemoInput => ({
  ...empty,
  recipientId: "1",
  receivedAt: "2026-11-05T14:30",
  companyName: "マイナビ",
  purpose: "message",
  ...v,
});
const errorsOf = (input: MemoInput) => {
  const r = validateMemoInput(input, RECIPIENTS);
  return r.ok ? {} : r.errors;
};

describe("MEMO_FIELD_LABELS（項目名＝エラーメッセージの {項目名}）", () => {
  it("仕様書 7.1・F-02 のとおり", () => {
    expect(MEMO_FIELD_LABELS).toEqual({
      recipientId: "宛先",
      receivedAt: "受電日時",
      companyName: "会社名",
      personName: "氏名",
      phone: "電話番号",
      purpose: "用件",
      message: "伝言",
      note: "メモ",
    });
  });
});

describe("validateMemoInput（S-04 の入力チェック）", () => {
  it("必須の項目を入れれば保存でき、受電日時は日本時間として UTC に直す", () => {
    expect(validateMemoInput(base(), RECIPIENTS)).toEqual({
      ok: true,
      values: {
        recipientId: 1,
        receivedAt: new Date("2026-11-05T05:30:00.000Z"),
        companyName: "マイナビ",
        personName: "",
        phone: "",
        purpose: "message",
        message: "",
        note: "",
      },
    });
  });

  it("AC-07：何も入力しないと、宛先・受電日時・会社名・用件に必須のエラー（氏名・電話番号・伝言・メモは任意）", () => {
    expect(errorsOf(empty)).toEqual({
      recipientId: ["宛先は必須です"],
      receivedAt: ["受電日時は必須です"],
      companyName: ["会社名は必須です"],
      purpose: ["用件は必須です"],
    });
  });

  it("AC-08：電話番号にハイフンを含むとエラー", () => {
    expect(errorsOf(base({ phone: "03-1234-5678" }))).toEqual({ phone: ["電話番号は半角数字のみで入力してください"] });
  });

  it("AC-09：用件が「折り返し希望」で電話番号が空なら「折り返し希望の場合、電話番号は必須です」", () => {
    expect(errorsOf(base({ purpose: "callback" }))).toEqual({ phone: ["折り返し希望の場合、電話番号は必須です"] });
    expect(errorsOf(base({ purpose: "callback", phone: "　" }))).toEqual({
      phone: ["折り返し希望の場合、電話番号は必須です"],
    });
    expect(validateMemoInput(base({ purpose: "callback", phone: "0312345678" }), RECIPIENTS).ok).toBe(true);
  });

  it("用件が「折り返し希望」以外なら、電話番号は空でもよい", () => {
    expect(validateMemoInput(base({ purpose: "notify" }), RECIPIENTS).ok).toBe(true);
    expect(validateMemoInput(base({ purpose: "message" }), RECIPIENTS).ok).toBe(true);
  });

  it("用件が未選択でも、電話番号の形式は確かめる", () => {
    expect(errorsOf(base({ purpose: "", phone: "03-1234" }))).toEqual({
      phone: ["電話番号は半角数字のみで入力してください"],
      purpose: ["用件は必須です"],
    });
  });

  it("AC-10・AC-33：会社名は255文字なら保存でき、256文字なら「会社名は255文字以内で入力してください」", () => {
    expect(validateMemoInput(base({ companyName: "あ".repeat(255) }), RECIPIENTS).ok).toBe(true);
    expect(errorsOf(base({ companyName: "あ".repeat(256) }))).toEqual({
      companyName: ["会社名は255文字以内で入力してください"],
    });
  });

  it("氏名は255文字なら保存でき、256文字ならエラー", () => {
    expect(validateMemoInput(base({ personName: "あ".repeat(255) }), RECIPIENTS).ok).toBe(true);
    expect(errorsOf(base({ personName: "あ".repeat(256) }))).toEqual({
      personName: ["氏名は255文字以内で入力してください"],
    });
  });

  it("AC-36・AC-37：伝言は1,000文字なら保存でき、1,001文字なら「伝言は1,000文字以内で入力してください」", () => {
    expect(validateMemoInput(base({ message: "あ".repeat(1000) }), RECIPIENTS).ok).toBe(true);
    expect(errorsOf(base({ message: "あ".repeat(1001) }))).toEqual({
      message: ["伝言は1,000文字以内で入力してください"],
    });
  });

  it("メモは1,000文字なら保存でき、1,001文字ならエラー", () => {
    expect(validateMemoInput(base({ note: "あ".repeat(1000) }), RECIPIENTS).ok).toBe(true);
    expect(errorsOf(base({ note: "あ".repeat(1001) }))).toEqual({ note: ["メモは1,000文字以内で入力してください"] });
  });

  it("伝言の改行（CRLF）は1文字と数える（仮。Q-M06）", () => {
    expect(validateMemoInput(base({ message: `${"あ".repeat(499)}\r\n${"あ".repeat(500)}` }), RECIPIENTS).ok).toBe(
      true,
    );
  });

  it("AC-64・AC-65：電話番号は15桁なら保存でき、16桁なら「電話番号は15桁以内で入力してください」", () => {
    expect(validateMemoInput(base({ phone: "012345678901234" }), RECIPIENTS).ok).toBe(true);
    expect(errorsOf(base({ phone: "0123456789012345" }))).toEqual({ phone: ["電話番号は15桁以内で入力してください"] });
  });

  it("電話番号に全角数字を含むとエラー（変換しない）", () => {
    expect(errorsOf(base({ phone: "０３１２３４５６７８" }))).toEqual({
      phone: ["電話番号は半角数字のみで入力してください"],
    });
  });

  it("選べない宛先（削除された宛先・存在しない宛先）は選ばれていないとみなす（仮。Q-M28）", () => {
    expect(errorsOf(base({ recipientId: "3" }))).toEqual({ recipientId: ["宛先は必須です"] });
    expect(errorsOf(base({ recipientId: "abc" }))).toEqual({ recipientId: ["宛先は必須です"] });
  });

  it("用件が3つ以外の値なら選ばれていないとみなす", () => {
    expect(errorsOf(base({ purpose: "折り返し希望" }))).toEqual({ purpose: ["用件は必須です"] });
  });

  it("受電日時が空白だけ・形式が違う・実在しない日時なら必須のエラー（仮。Q-M28）", () => {
    for (const receivedAt of [" ", "2026/11/05 14:30", "2026-02-30T10:00", "2026-11-05"]) {
      expect(errorsOf(base({ receivedAt }))).toEqual({ receivedAt: ["受電日時は必須です"] });
    }
  });

  it("会社名・氏名・電話番号は前後の空白を削る。伝言・メモは削らない（Q-M11）", () => {
    const r = validateMemoInput(
      base({
        companyName: " マイナビ　",
        personName: "\t原田 ",
        phone: " 0312345678 ",
        message: " 伝言\n",
        note: "\nメモ",
      }),
      RECIPIENTS,
    );
    expect(r.ok && r.values).toMatchObject({
      companyName: "マイナビ",
      personName: "原田",
      phone: "0312345678",
      message: " 伝言\n",
      note: "\nメモ",
    });
  });

  it("会社名が空白だけなら必須のエラー（Q-M07）", () => {
    expect(errorsOf(base({ companyName: "　" }))).toEqual({ companyName: ["会社名は必須です"] });
  });

  it("1つの欄の複数のエラーをすべて返す（Q-M09）", () => {
    expect(errorsOf(base({ companyName: "a".repeat(256), phone: "0123-4567-8901-2345" }))).toEqual({
      companyName: ["会社名は255文字以内で入力してください"],
      phone: ["電話番号は半角数字のみで入力してください"],
    });
  });

  it("エラーのときは、入力した値をそのまま返す（画面に残す）", () => {
    const input = base({ companyName: " ", message: "伝言" });
    const r = validateMemoInput(input, RECIPIENTS);
    expect(!r.ok && r.input).toEqual(input);
  });
});

describe("changeMemoStatus（F-05 対処済み・未対処の切り替え）", () => {
  const now = new Date("2026-11-05T05:30:00.000Z");
  const open = { status: "open", doneBy: null, doneAt: null } as const;
  const done = { status: "done", doneBy: 1, doneAt: "2026-11-05T02:00:00.000Z" } as const;

  it("AC-18・AC-53：対処済みにすると、対処済みにした人と押した日時を記録する", () => {
    expect(changeMemoStatus(open, "done", 1, now)).toEqual({
      status: "done",
      doneBy: 1,
      doneAt: "2026-11-05T05:30:00.000Z",
    });
  });

  it("AC-63：宛先本人以外（益岡）でも対処済みにでき、益岡を記録する", () => {
    expect(changeMemoStatus(open, "done", 2, now)).toMatchObject({ status: "done", doneBy: 2 });
  });

  it("AC-19・AC-54：未対処に戻すと、対処済みにした人と日時を消す", () => {
    expect(changeMemoStatus(done, "open", 2, now)).toEqual({ status: "open", doneBy: null, doneAt: null });
  });

  it("既にその状態なら何も変えない（対処済みにした人・日時を上書きしない。仮。Q-M33）", () => {
    expect(changeMemoStatus(done, "done", 2, now)).toEqual(done);
    expect(changeMemoStatus(open, "open", 2, now)).toEqual(open);
  });
});
