import { describe, expect, it } from "vitest";
import type { MemoStatus } from "../../src/domain/memo.ts";
import {
  EMPTY_MEMO_LIST_QUERY,
  filterMemos,
  MEMO_PAGE_SIZE,
  type MemoListQuery,
  paginate,
  parseMemoFilter,
} from "../../src/domain/memo-list.ts";

type TestMemo = {
  id: number;
  recipientId: number;
  receivedAt: string;
  createdAt: string;
  companyName: string;
  personName: string;
  phone: string;
  message: string;
  note: string;
  status: MemoStatus;
  deleted: boolean;
};

// 日本時間の日時を UTC の ISO 文字列にする
const jst = (s: string) => new Date(`${s}+09:00`).toISOString();

const memo = (id: number, v: Partial<TestMemo> = {}): TestMemo => ({
  id,
  recipientId: 1,
  receivedAt: jst("2026-11-05T10:00"),
  createdAt: jst("2026-11-05T10:00"),
  companyName: `会社${id}`,
  personName: "",
  phone: "",
  message: "",
  note: "",
  status: "open",
  deleted: false,
  ...v,
});

const q = (v: Partial<MemoListQuery> = {}): MemoListQuery => ({ ...EMPTY_MEMO_LIST_QUERY, ...v });
const ids = (memos: TestMemo[], query: Partial<MemoListQuery>, my: number[] = [1]) =>
  filterMemos(memos, parseMemoFilter(q(query)), my).map((m) => m.id);

describe("filterMemos（S-02 の絞り込み・キーワード）", () => {
  it("開いたときは全員宛て・全状態（F-03）", () => {
    const memos = [memo(1), memo(2, { status: "done" }), memo(3, { recipientId: 2 })];
    expect(ids(memos, {}).sort()).toEqual([1, 2, 3]);
  });

  it("AC-11：宛先「自分宛て」・状態「未対処」で、自分宛ての未対処だけ", () => {
    const memos = [memo(1), memo(2, { status: "done" }), memo(3, { recipientId: 2 })];
    expect(ids(memos, { recipient: "me", status: "open" })).toEqual([1]);
  });

  it("「自分宛て」は、ログイン中の利用者と同じメールアドレスの宛先（宛先でない利用者は0件）", () => {
    const memos = [memo(1), memo(2, { recipientId: 2 })];
    expect(ids(memos, { recipient: "me" }, [2])).toEqual([2]);
    expect(ids(memos, { recipient: "me" }, [])).toEqual([]);
  });

  it("宛先を1人選ぶと、その宛先の取次メモだけ", () => {
    const memos = [memo(1), memo(2, { recipientId: 2 })];
    expect(ids(memos, { recipient: "2" })).toEqual([2]);
  });

  it("状態「対処済み」", () => {
    const memos = [memo(1), memo(2, { status: "done" })];
    expect(ids(memos, { status: "done" })).toEqual([2]);
  });

  it("AC-12：キーワード「見積」で、伝言に「見積」を含むものだけ", () => {
    const memos = [memo(1, { message: "見積書を送付しました" }), memo(2, { message: "来週の打ち合わせの件" })];
    expect(ids(memos, { q: "見積" })).toEqual([1]);
  });

  it("AC-14：キーワード「請求」に当たるものがなければ0件", () => {
    expect(ids([memo(1, { message: "見積書を送付しました" })], { q: "請求" })).toEqual([]);
  });

  it("キーワードは会社名・氏名・電話番号・伝言・メモのいずれかに部分一致", () => {
    const memos = [
      memo(1, { companyName: "マイナビ" }),
      memo(2, { personName: "原田" }),
      memo(3, { phone: "0312345678" }),
      memo(4, { message: "原田さんから" }),
      memo(5, { note: "折り返しは原田へ" }),
    ];
    expect(ids(memos, { q: "マイナ" })).toEqual([1]);
    expect(ids(memos, { q: "原田" }).sort()).toEqual([2, 4, 5]);
    expect(ids(memos, { q: "1234" })).toEqual([3]);
  });

  it("キーワードは入力どおりに比べる（ひらがな・カタカナ、全角・半角を同じものとして扱わない）", () => {
    const memos = [memo(1, { companyName: "マイナビ" }), memo(2, { phone: "0312345678" })];
    expect(ids(memos, { q: "まいなび" })).toEqual([]);
    expect(ids(memos, { q: "０３" })).toEqual([]);
  });

  it("キーワードが空白だけなら絞り込まない（仮。Q-M31）", () => {
    expect(ids([memo(1), memo(2)], { q: "　 " }).sort()).toEqual([1, 2]);
  });

  it("削除された取次メモは表示しない", () => {
    expect(ids([memo(1), memo(2, { deleted: true })], {})).toEqual([1]);
  });

  it("絞り込みとキーワードは両方を満たすものだけ", () => {
    const memos = [memo(1, { message: "見積" }), memo(2, { message: "見積", status: "done" })];
    expect(ids(memos, { q: "見積", status: "open" })).toEqual([1]);
  });

  it("読めない値の条件は絞り込まない（仮。Q-M31）", () => {
    const memos = [memo(1), memo(2, { status: "done", recipientId: 2 })];
    expect(ids(memos, { recipient: "abc", status: "未対処", from: "2026/11/01", to: "x" }).sort()).toEqual([1, 2]);
  });
});

describe("filterMemos：受電日時の期間（日本時間の日付。両端の日を含む）", () => {
  const memos = [
    memo(1, { receivedAt: jst("2026-11-01T10:00") }),
    memo(2, { receivedAt: jst("2026-11-03T10:00") }),
    memo(3, { receivedAt: jst("2026-11-05T10:00") }),
  ];

  it("AC-52：2026/11/02〜2026/11/04 で ② だけ", () => {
    expect(ids(memos, { from: "2026-11-02", to: "2026-11-04" })).toEqual([2]);
  });

  it("始まりの日の 0:00（日本時間）は含み、前の日の 23:59 は含まない", () => {
    const edge = [memo(1, { receivedAt: jst("2026-11-01T23:59") }), memo(2, { receivedAt: jst("2026-11-02T00:00") })];
    expect(ids(edge, { from: "2026-11-02" })).toEqual([2]);
  });

  it("終わりの日の 23:59（日本時間）は含み、次の日の 0:00 は含まない", () => {
    const edge = [memo(1, { receivedAt: jst("2026-11-04T23:59") }), memo(2, { receivedAt: jst("2026-11-05T00:00") })];
    expect(ids(edge, { to: "2026-11-04" })).toEqual([1]);
  });

  it("UTC では前の日でも、日本時間でその日なら含む（2026/11/02 08:00 JST は UTC で 11/01 23:00）", () => {
    expect(ids([memo(1, { receivedAt: jst("2026-11-02T08:00") })], { from: "2026-11-02", to: "2026-11-02" })).toEqual([
      1,
    ]);
  });

  it("片方だけでも絞り込める", () => {
    expect(ids(memos, { from: "2026-11-03" })).toEqual([3, 2]);
    expect(ids(memos, { to: "2026-11-03" })).toEqual([2, 1]);
  });

  it("始まりが終わりより後なら0件", () => {
    expect(ids(memos, { from: "2026-11-05", to: "2026-11-01" })).toEqual([]);
  });
});

describe("filterMemos：並び順", () => {
  it("受電日時の新しい順", () => {
    const memos = [
      memo(1, { receivedAt: jst("2026-11-03T10:00") }),
      memo(2, { receivedAt: jst("2026-11-05T10:00") }),
      memo(3, { receivedAt: jst("2026-11-01T10:00") }),
    ];
    expect(ids(memos, {})).toEqual([2, 1, 3]);
  });

  it("受電日時が同じなら、後から作成したものが先（仮。Q-M32）", () => {
    const memos = [
      memo(1, { createdAt: jst("2026-11-05T10:05") }),
      memo(2, { createdAt: jst("2026-11-05T10:01") }),
      memo(3, { createdAt: jst("2026-11-05T10:05") }),
    ];
    expect(ids(memos, {})).toEqual([3, 1, 2]);
  });
});

describe("paginate（1ページ50件）", () => {
  const items = Array.from({ length: 51 }, (_, i) => i + 1);

  it("1ページは50件", () => {
    expect(MEMO_PAGE_SIZE).toBe(50);
  });

  it("AC-38：51件なら1ページ目は先頭から50件、2ページ目に51件目", () => {
    const first = paginate(items, "");
    expect(first.items).toHaveLength(50);
    expect(first.items[0]).toBe(1);
    expect(first.items[49]).toBe(50);
    expect(first).toMatchObject({ page: 1, pageCount: 2 });
    expect(paginate(items, "2")).toEqual({ items: [51], page: 2, pageCount: 2 });
  });

  it("50件ちょうどなら1ページ", () => {
    expect(paginate(items.slice(0, 50), "")).toMatchObject({ page: 1, pageCount: 1 });
  });

  it("0件でもページの数は1", () => {
    expect(paginate([], "")).toEqual({ items: [], page: 1, pageCount: 1 });
  });

  it("読めないページ番号は1ページ目、ページの数を超えたら最後のページ（仮。Q-M04）", () => {
    expect(paginate(items, "abc").page).toBe(1);
    expect(paginate(items, "0").page).toBe(1);
    expect(paginate(items, "9").page).toBe(2);
  });
});
