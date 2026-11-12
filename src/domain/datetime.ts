// 日本時間（Asia/Tokyo）での日時の扱い
// Workers は UTC で動くため、表示・入力の初期値・期間の絞り込みのすべてで明示的に変換する。
// 日本は夏時間がないので、UTC+9 の固定で変換する。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

// 日本時間の年月日時分（UTC の getter で読むために9時間ずらした Date）
function jstParts(value: Date | string) {
  const shifted = new Date(toDate(value).getTime() + JST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

// 画面の表示：「2026/11/05 14:30」（分単位、ゼロ埋め。仕様書 7.1）
export function formatJst(value: Date | string): string {
  const p = jstParts(value);
  return `${p.year}/${pad2(p.month)}/${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

// <input type="datetime-local"> の値：「2026-11-05T14:30」
export function toJstDateTimeLocal(value: Date | string): string {
  const p = jstParts(value);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

// 年月日時分が実在するか（2026-02-30 などを弾く）
function isValidParts(year: number, month: number, day: number, hour = 0, minute = 0): boolean {
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day &&
    d.getUTCHours() === hour &&
    d.getUTCMinutes() === minute
  );
}

// <input type="datetime-local"> の値（日本時間）を UTC の Date にする。形式が違えば null
export function parseJstDateTimeLocal(value: string): Date | null {
  const m = DATETIME_LOCAL_PATTERN.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (!isValidParts(year, month, day, hour, minute)) return null;
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - JST_OFFSET_MS);
}

// 日本時間のその日の 0:00 を UTC の Date にする（<input type="date"> の値「2026-11-02」）。形式が違えば null
export function jstStartOfDay(value: string): Date | null {
  const m = DATE_PATTERN.exec(value);
  if (!m) return null;
  const [year, month, day] = m.slice(1).map(Number) as [number, number, number];
  if (!isValidParts(year, month, day)) return null;
  return new Date(Date.UTC(year, month - 1, day) - JST_OFFSET_MS);
}
