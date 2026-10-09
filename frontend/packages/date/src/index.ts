/**
 * 날짜 표시에 필요한 순수 변환을 제공한다. 서버 저장값이나 폼의 원본을 바꾸지 않는다.
 * Java의 LocalDate에 가까운 달력 날짜와 Instant에 가까운 UTC 시각을 별도 메서드로 다룬다.
 * locale/timeZone은 생성 시 전달되며 Vue의 ref나 전역 선택 상태를 이 패키지에 보관하지 않는다.
 */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import "dayjs/locale/ko.js";
import "dayjs/locale/en.js";

// Day.js의 UTC/시간대 기능을 등록한다. 언어 모듈도 로드하지만 전역 locale을 변경하지 않고
// 아래 각 Day.js 값에 .locale(locale)을 적용해 서로 다른 앱의 표시 설정이 섞이지 않게 한다.
dayjs.extend(utc);
dayjs.extend(timezone);

export type DateLocale = "ko" | "en";
// kind가 판별자(discriminant)인 유니온 타입이다. kind === "valid"를 확인한 분기에서만
// epochMilliseconds를 사용할 수 있다. Readonly는 정적 쓰기 방지이며 값의 런타임 freeze는 아니다.
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
// 서버 시각은 끝이 Z인 UTC 문자열만 받는다. 브라우저의 관대한 Date 문자열 파싱에 맡기지 않는다.
const timestampPattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;

/** 달력 날짜는 Instant가 아니다. 시간대 이동 없이 그레고리력 날짜 자체를 검사한다. */
export function isCalendarDate(value: string): boolean {
  const parts = calendarPattern.exec(value);
  if (!parts) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  // 윤년의 4/100/400년 규칙과 월별 일수를 확인해 2월 30일 같은 자동 보정 날짜를 거절한다.
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!;
}

// 검증된 날짜를 포맷 라이브러리에 건네기 위한 UTC 기준 Date다. 사용자의 현지 자정을 뜻하지 않는다.
function calendarAnchor(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  // Date.UTC(0..99)는 1900년대로 바꾸므로 setUTCFullYear로 실제 연도를 설정한다.
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day!);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

// IANA 시간대의 실제 벽시각 구성 요소를 얻는다. 고정 달력/숫자 체계를 사용해
// 사용자 언어의 숫자나 AM/PM 표현이 아래 계산에 섞이지 않도록 한다.
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
// UTC epoch를 지정 지역의 년/월/일/시/분/초로 읽어 UTC 필드에 옮긴다.
// 이 임시 wall 값과 원래 epoch의 차이가 해당 시점의 시간대 offset이다. 과거 초 단위 offset도 보존한다.
function displayParts(epochMilliseconds: number, formatter: Intl.DateTimeFormat) {
  const parts = formatter.formatToParts(epochMilliseconds);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = values.era === "BC" ? 1 - Number(values.year) : Number(values.year);
  const wall = new Date(0);
  wall.setUTCFullYear(year, Number(values.month) - 1, Number(values.day));
  wall.setUTCHours(Number(values.hour), Number(values.minute), Number(values.second), 0);
  const offsetSeconds = (wall.getTime() - Math.floor(epochMilliseconds / 1000) * 1000) / 1000;
  // offset은 정수 초로 구했으므로 원본 밀리초는 차이를 계산한 다음 별도로 복원한다.
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
  // Java Instant의 나노초 문자열은 원문으로 유지하되 JS Date 표시 계산은 밀리초 3자리까지만 쓴다.
  // !는 앞선 형식 검사로 값이 있다고 TypeScript에 알리는 단언이며 실행 시 검사 코드는 아니다.
  const milliseconds = Number((parts[5] ?? "").padEnd(3, "0").slice(0, 3));
  date.setUTCHours(hour, minute, second, milliseconds);
  return { kind: "valid", raw: value, epochMilliseconds: date.getTime() };
}

/**
 * locale/timeZone과 빈값·잘못된 값의 표시 문구를 받아 두 포맷 함수를 반환한다.
 * 반환 객체의 설정/메서드는 Object.freeze로 고정되므로 locale이 바뀌면 새 formatter를 만들면 된다.
 * Vue 화면의 computed에서 현재 설정으로 생성할 수 있지만 이 유틸 자체는 반응형 상태를 갖지 않는다.
 */
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
      // 달력 날짜에는 tz(zone)를 적용하지 않는다. 지역 이동으로 날짜가 하루 앞/뒤로 밀리면 안 된다.
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
        // 대괄호로 묶은 Day.js 리터럴은 건드리지 않고 연도/offset 토큰만 계산값으로 치환한다.
        // 일반 분기는 플러그인, 특수 역사 날짜 분기는 Intl 결과를 사용해 같은 표시 계약을 유지한다.
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
