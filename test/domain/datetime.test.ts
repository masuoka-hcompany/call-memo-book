import { describe, expect, it } from "vitest";
import { formatJst, jstStartOfDay, parseJstDateTimeLocal, toJstDateTimeLocal } from "../../src/domain/datetime.ts";

describe("formatJst（日本時間で「2026/11/05 14:30」）", () => {
  it("UTC を日本時間（+9時間）で表示する", () => {
    expect(formatJst("2026-11-05T05:30:00.000Z")).toBe("2026/11/05 14:30");
  });

  it("Date も受け付ける", () => {
    expect(formatJst(new Date("2026-11-05T05:30:00Z"))).toBe("2026/11/05 14:30");
  });

  it("UTC で前日でも、日本時間の日付で表示する", () => {
    expect(formatJst("2026-11-04T15:00:00Z")).toBe("2026/11/05 00:00");
    expect(formatJst("2026-11-04T14:59:00Z")).toBe("2026/11/04 23:59");
  });

  it("月・日・時・分をゼロ埋めする", () => {
    expect(formatJst("2026-01-02T00:05:00Z")).toBe("2026/01/02 09:05");
  });

  it("年をまたぐ", () => {
    expect(formatJst("2026-12-31T15:00:00Z")).toBe("2027/01/01 00:00");
  });

  it("秒は切り捨てて分単位で表示する", () => {
    expect(formatJst("2026-11-05T05:30:59.999Z")).toBe("2026/11/05 14:30");
  });
});

describe("toJstDateTimeLocal（datetime-local の値）", () => {
  it("日本時間の「YYYY-MM-DDTHH:mm」にする", () => {
    expect(toJstDateTimeLocal("2026-11-04T15:00:00Z")).toBe("2026-11-05T00:00");
    expect(toJstDateTimeLocal(new Date("2026-11-05T05:30:00Z"))).toBe("2026-11-05T14:30");
  });
});

describe("parseJstDateTimeLocal", () => {
  it("日本時間として読み、UTC にする", () => {
    expect(parseJstDateTimeLocal("2026-11-05T14:30")?.toISOString()).toBe("2026-11-05T05:30:00.000Z");
    expect(parseJstDateTimeLocal("2026-11-05T00:00")?.toISOString()).toBe("2026-11-04T15:00:00.000Z");
  });

  it("toJstDateTimeLocal と往復できる", () => {
    const iso = "2026-11-05T05:30:00.000Z";
    expect(parseJstDateTimeLocal(toJstDateTimeLocal(iso))?.toISOString()).toBe(iso);
  });

  it("形式が違う・実在しない日時は null", () => {
    expect(parseJstDateTimeLocal("")).toBeNull();
    expect(parseJstDateTimeLocal("2026/11/05 14:30")).toBeNull();
    expect(parseJstDateTimeLocal("2026-11-05T14:30:00")).toBeNull();
    expect(parseJstDateTimeLocal("2026-02-30T10:00")).toBeNull();
    expect(parseJstDateTimeLocal("2026-11-05T24:00")).toBeNull();
  });
});

describe("jstStartOfDay（日本時間のその日の 0:00）", () => {
  it("UTC の前日 15:00 になる", () => {
    expect(jstStartOfDay("2026-11-02")?.toISOString()).toBe("2026-11-01T15:00:00.000Z");
  });

  it("形式が違う・実在しない日付は null", () => {
    expect(jstStartOfDay("2026/11/02")).toBeNull();
    expect(jstStartOfDay("2026-13-01")).toBeNull();
  });
});
