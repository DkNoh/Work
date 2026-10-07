import { describe, expect, it } from "vitest";
import { createDateFormatter, isCalendarDate, parseUtcTimestamp } from "./index";

describe("Gregorian calendar validation", () => {
  it("keeps early years and checks century leap years without normalizing overflow", () => {
    for (const value of ["0000-02-29", "0001-01-01", "0099-12-31", "2000-02-29", "9999-12-31"])
      expect(isCalendarDate(value)).toBe(true);
    for (const value of [
      "1900-02-29",
      "2025-02-29",
      "2026-04-31",
      "2026-00-01",
      "2026-13-01",
      "2026-01-00",
      "2026-1-01",
      "10000-01-01",
    ])
      expect(isCalendarDate(value)).toBe(false);
  });
  it("never shifts a calendar date according to the display zone", () => {
    const korea = createDateFormatter({ locale: "en", timeZone: "Asia/Seoul" });
    const america = createDateFormatter({ locale: "en", timeZone: "America/Los_Angeles" });
    for (const value of ["0000-01-01", "0099-12-31", "2026-10-06"]) {
      expect(korea.formatCalendarDate(value, "YYYY-MM-DD")).toBe(value);
      expect(america.formatCalendarDate(value, "YYYY-MM-DD")).toBe(value);
    }
  });
});
describe("UTC instant parsing and display", () => {
  it("preserves microseconds and nanoseconds as raw server strings", () => {
    for (const fraction of ["1", "123456", "123456789"]) {
      const raw = `2026-10-06T12:34:56.${fraction}Z`;
      const result = parseUtcTimestamp(raw);
      expect(result).toEqual({
        kind: "valid",
        raw,
        epochMilliseconds: Date.UTC(
          2026,
          9,
          6,
          12,
          34,
          56,
          Number(fraction.padEnd(3, "0").slice(0, 3)),
        ),
      });
    }
  });
  it("rejects offset/local timestamps, date and clock overflow instead of accepting Day.js normalization", () => {
    for (const raw of [
      "2026-02-30T00:00:00Z",
      "2026-10-06T24:00:00Z",
      "2026-10-06T00:60:00Z",
      "2026-10-06T00:00:60Z",
      "2026-10-06T00:00:00.1234567890Z",
      "2026-10-06T00:00:00+00:00",
      "2026-10-06T00:00:00",
      " ",
    ])
      expect(parseUtcTimestamp(raw)).toEqual({ kind: "invalid", raw });
    expect(parseUtcTimestamp(null).kind).toBe("empty");
    expect(parseUtcTimestamp("").kind).toBe("empty");
    expect(parseUtcTimestamp("0099-01-01T00:00:00Z").kind).toBe("valid");
  });
  it("formats explicit instants at the DST boundary and rejects unknown zones", () => {
    const formatter = createDateFormatter({ locale: "en", timeZone: "America/New_York" });
    expect(formatter.formatTimestamp("2026-03-08T06:59:59Z")).toBe("2026-03-08 01:59:59 -05:00");
    expect(formatter.formatTimestamp("2026-03-08T07:00:00Z")).toBe("2026-03-08 03:00:00 -04:00");
    expect(() => createDateFormatter({ locale: "en", timeZone: "Not/A_Zone" })).toThrow(RangeError);
  });
  it("displays early timestamp years and historical offset seconds without the timezone plugin's year coercion", () => {
    const utc = createDateFormatter({ locale: "en", timeZone: "UTC" });
    const seoul = createDateFormatter({ locale: "en", timeZone: "Asia/Seoul" });
    expect(utc.formatTimestamp("0000-01-01T00:00:00Z")).toBe("0000-01-01 00:00:00 +00:00");
    expect(utc.formatTimestamp("0099-01-01T00:00:00Z")).toBe("0099-01-01 00:00:00 +00:00");
    expect(utc.formatTimestamp("0100-01-01T00:00:00Z")).toBe("0100-01-01 00:00:00 +00:00");
    expect(seoul.formatTimestamp("0099-01-01T00:00:00Z")).toBe("0099-01-01 08:27:52 +08:27:52");
  });
  it("isolates locale and zone choices and displays empty/invalid values without Invalid Date", () => {
    const ko = createDateFormatter({ locale: "ko", timeZone: "Asia/Seoul" });
    const en = createDateFormatter({
      locale: "en",
      timeZone: "UTC",
      emptyDisplay: "Empty",
      invalidDisplay: "Check the date",
    });
    expect(ko.formatCalendarDate("2026-10-06")).toBe("2026년 10월 6일");
    expect(en.formatCalendarDate("2026-10-06")).toBe("Oct 6, 2026");
    expect(ko.formatCalendarDate("2026-10-06")).toBe("2026년 10월 6일");
    expect(ko.formatTimestamp("2026-10-06T00:00:00Z")).toBe("2026-10-06 09:00:00 +09:00");
    expect(en.formatTimestamp("2026-10-06T00:00:00Z")).toBe("2026-10-06 00:00:00 +00:00");
    expect(en.formatTimestamp(null)).toBe("Empty");
    expect(en.formatTimestamp("bad")).toBe("Check the date");
  });
});
