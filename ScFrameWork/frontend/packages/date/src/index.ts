import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import "dayjs/locale/ko.js";
import "dayjs/locale/en.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export type DateLocale = "ko" | "en";
export type ParsedUtcTimestamp =
  | Readonly<{ kind: "empty"; raw: string | null }>
  | Readonly<{ kind: "invalid"; raw: string }>
  | Readonly<{ kind: "valid"; raw: string; epochMilliseconds: number }>;
export interface DateFormatterOptions {
  locale: DateLocale;
  timeZone: string;
  emptyDisplay?: string;
  invalidDisplay?: string;
}

const calendarPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timestampPattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;

/** 달력 날짜는 Instant가 아니다. 시간대 이동 없이 그레고리력 날짜 자체를 검사한다. */
export function isCalendarDate(value: string): boolean {
  const parts = calendarPattern.exec(value);
  if (!parts) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!;
}

function calendarAnchor(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  // Date.UTC(0..99)는 1900년대로 바꾸므로 setUTCFullYear로 실제 연도를 설정한다.
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day!);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function createDisplayFormatter(zone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    calendar: "gregory",
    numberingSystem: "latn",
    era: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}
function displayParts(epochMilliseconds: number, formatter: Intl.DateTimeFormat) {
  const parts = formatter.formatToParts(epochMilliseconds);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = values.era === "BC" ? 1 - Number(values.year) : Number(values.year);
  const wall = new Date(0);
  wall.setUTCFullYear(year, Number(values.month) - 1, Number(values.day));
  wall.setUTCHours(Number(values.hour), Number(values.minute), Number(values.second), 0);
  const offsetSeconds = (wall.getTime() - Math.floor(epochMilliseconds / 1000) * 1000) / 1000;
  wall.setUTCMilliseconds(new Date(epochMilliseconds).getUTCMilliseconds());
  const padded = (value: number) => String(value).padStart(2, "0");
  const absolute = Math.abs(offsetSeconds);
  const sign = offsetSeconds < 0 ? "-" : "+";
  const offset = `${sign}${padded(Math.floor(absolute / 3600))}:${padded(Math.floor(absolute / 60) % 60)}${absolute % 60 ? `:${padded(absolute % 60)}` : ""}`;
  return { wall, year, offsetSeconds, offset };
}

/** 서버 원문을 저장용으로 다시 직렬화하지 않는다. 소수초 1~9자리도 raw에 그대로 남긴다. */
export function parseUtcTimestamp(value: string | null): ParsedUtcTimestamp {
  if (value === null || value === "") return { kind: "empty", raw: value };
  const parts = timestampPattern.exec(value);
  if (!parts || !isCalendarDate(parts[1]!)) return { kind: "invalid", raw: value };
  const hour = Number(parts[2]);
  const minute = Number(parts[3]);
  const second = Number(parts[4]);
  if (hour > 23 || minute > 59 || second > 59) return { kind: "invalid", raw: value };
  const date = calendarAnchor(parts[1]!);
  const milliseconds = Number((parts[5] ?? "").padEnd(3, "0").slice(0, 3));
  date.setUTCHours(hour, minute, second, milliseconds);
  return { kind: "valid", raw: value, epochMilliseconds: date.getTime() };
}

export function createDateFormatter(options: DateFormatterOptions) {
  if (options.locale !== "ko" && options.locale !== "en")
    throw new RangeError("Unsupported date locale");
  if (!/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(options.timeZone))
    throw new RangeError("Invalid IANA time zone");
  // Intl이 IANA 식별자와 UTC를 검사한다. 잘못된 시간대를 다른 지역으로 대체하지 않는다.
  const displayFormatter = createDisplayFormatter(options.timeZone);
  displayFormatter.format(0);
  const locale = options.locale;
  const zone = options.timeZone;
  const emptyDisplay = options.emptyDisplay ?? "—";
  const invalidDisplay =
    options.invalidDisplay ?? (locale === "ko" ? "유효하지 않은 날짜" : "Invalid date");
  return Object.freeze({
    locale,
    timeZone: zone,
    formatCalendarDate(value: string | null, pattern?: string): string {
      if (value === null || value === "") return emptyDisplay;
      if (!isCalendarDate(value)) return invalidDisplay;
      return dayjs
        .utc(calendarAnchor(value))
        .locale(locale)
        .format(pattern ?? (locale === "ko" ? "YYYY년 M월 D일" : "MMM D, YYYY"));
    },
    formatTimestamp(value: string | null, pattern = "YYYY-MM-DD HH:mm:ss Z"): string {
      const parsed = parseUtcTimestamp(value);
      if (parsed.kind === "empty") return emptyDisplay;
      if (parsed.kind === "invalid") return invalidDisplay;
      const display = displayParts(parsed.epochMilliseconds, displayFormatter);
      // timezone 플러그인의 문자열 재파싱은 0~999년과 역사적 초 단위 offset을 오해한다.
      // 그 경계만 Intl의 실제 IANA 벽시각을 Date로 옮기고 Day.js UTC/locale 포맷을 사용한다.
      if (
        new Date(parsed.epochMilliseconds).getUTCFullYear() < 1000 ||
        display.year < 1000 ||
        display.offsetSeconds % 60 !== 0
      ) {
        const year = `${display.year < 0 ? "-" : ""}${String(Math.abs(display.year)).padStart(4, "0")}`;
        const safePattern = pattern.replace(
          /(\[[^\]]*\])|YYYY|ZZ|Z/g,
          (token, literal: string | undefined) =>
            literal ??
            `[${token === "YYYY" ? year : token === "ZZ" ? display.offset.replaceAll(":", "") : display.offset}]`,
        );
        return dayjs.utc(display.wall).locale(locale).format(safePattern);
      }
      return dayjs.utc(parsed.epochMilliseconds).tz(zone).locale(locale).format(pattern);
    },
  });
}
