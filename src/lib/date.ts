import moment from 'moment-timezone';

/**
 * App-wide dates, always in UK time (Europe/London, so GMT/BST is handled automatically):
 * - display: "DD MMM, YYYY"  e.g. 05 Mar, 2026
 * - input:   "DD/MM/YYYY"    e.g. 05/03/2026
 */
export const APP_TIMEZONE = 'Europe/London';
export const DISPLAY_FORMAT = 'DD MMM, YYYY';
export const INPUT_FORMAT = 'DD/MM/YYYY';
/** Shown next to date input labels. */
export const INPUT_FORMAT_HINT = '(DD/MM/YYYY)';
const TIME_FORMAT = 'h:mm A';

type DateInput = string | number | Date | null | undefined;

/** A moment in UK time, or null when the value isn't a valid date. */
export function ukMoment(value?: DateInput) {
  if (value === undefined || value === null || value === '') return null;
  const m = moment.tz(value, APP_TIMEZONE);
  return m.isValid() ? m : null;
}

/** Now, in UK time. */
export const ukNow = () => moment.tz(APP_TIMEZONE);

/** "DD MMM, YYYY" in UK time — or the fallback when there's no valid date. */
export function formatDisplayDate(value?: DateInput, fallback = '—') {
  return ukMoment(value)?.format(DISPLAY_FORMAT) ?? fallback;
}

/** "DD/MM/YYYY" in UK time — for date inputs. */
export function formatInputDate(value?: DateInput) {
  return ukMoment(value)?.format(INPUT_FORMAT) ?? '';
}

/** "h:mm AM" in UK time. */
export function formatTime(value?: DateInput) {
  return ukMoment(value)?.format(TIME_FORMAT) ?? '';
}

/** Parses "DD/MM/YYYY" (strictly) as midnight UK time; null if invalid (e.g. 31/02/2026). */
export function parseInputDate(text: string): Date | null {
  const m = moment.tz(text.trim(), INPUT_FORMAT, true, APP_TIMEZONE);
  return m.isValid() ? m.startOf('day').toDate() : null;
}

/**
 * The native date picker returns the chosen day in the phone's own time zone.
 * Keep that calendar day but make it midnight UK time.
 */
export function fromPickerDate(date: Date): Date {
  return moment.tz({ year: date.getFullYear(), month: date.getMonth(), date: date.getDate() }, APP_TIMEZONE).toDate();
}

/** Turns a UK date back into a Date the native picker shows as the same calendar day. */
export function toPickerDate(value?: DateInput): Date | undefined {
  const m = ukMoment(value);
  return m ? new Date(m.year(), m.month(), m.date()) : undefined;
}

/** Midnight today, UK time. */
export function ukStartOfToday(): Date {
  return ukNow().startOf('day').toDate();
}

/** Whether two values fall on the same UK calendar day. */
export function isSameUkDay(a: DateInput, b: DateInput) {
  const ma = ukMoment(a);
  const mb = ukMoment(b);
  return !!ma && !!mb && ma.isSame(mb, 'day');
}

/** Next date on a weekday (0 = Sun … 6 = Sat), from today in UK time (same as the web form). */
export function nextUkWeekday(dayIndex: number): Date {
  const today = ukNow().startOf('day');
  const candidate = today.clone().day(dayIndex);
  if (candidate.isBefore(today)) candidate.add(1, 'week');
  return candidate.toDate();
}

/** Next date on a day of the month (1–31), from today in UK time (same as the web form). */
export function nextUkMonthDay(day: number): Date {
  const today = ukNow().startOf('day');
  const candidate = today.clone().date(day);
  if (candidate.isBefore(today)) candidate.add(1, 'month');
  return candidate.toDate();
}
