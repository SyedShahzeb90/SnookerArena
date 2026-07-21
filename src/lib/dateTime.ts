import { useClubSettingsStore, type ClubSettings } from "@/features/settings/store/clubSettingsStore";

type DateValue = Date | string | number | null | undefined;
type DateFormat = ClubSettings["dateFormat"];
type TimeFormat = ClubSettings["timeFormat"];

function parseDate(value: DateValue): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatAppDate(
  value: DateValue,
  dateFormat: DateFormat = useClubSettingsStore.getState().settings.dateFormat
) {
  const date = parseDate(value);
  if (!date) return "—";
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  if (dateFormat === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  if (dateFormat === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  return `${day}/${month}/${year}`;
}

export function formatAppTime(
  value: DateValue,
  timeFormat: TimeFormat = useClubSettingsStore.getState().settings.timeFormat
) {
  const date = parseDate(value);
  if (!date) return "—";
  const minutes = pad(date.getMinutes());
  if (timeFormat === "24-hour") return `${pad(date.getHours())}:${minutes}`;
  const hours = date.getHours();
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
}

export function formatAppDateTime(
  value: DateValue,
  settings: Pick<ClubSettings, "dateFormat" | "timeFormat"> = useClubSettingsStore.getState().settings
) {
  const date = parseDate(value);
  if (!date) return "—";
  return `${formatAppDate(date, settings.dateFormat)} ${formatAppTime(date, settings.timeFormat)}`;
}

function isSameCalendarDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

export function formatChargeTimeRange(
  startedAt?: string,
  endedAt?: string,
  referenceDate?: string
) {
  const started = parseDate(startedAt);
  const ended = parseDate(endedAt);
  const reference = parseDate(referenceDate);
  const showDates = Boolean(
    started && ended && !isSameCalendarDate(started, ended) ||
    started && reference && !isSameCalendarDate(started, reference) ||
    ended && reference && !isSameCalendarDate(ended, reference)
  );
  const formatEndpoint = (date: Date | null) => {
    if (!date) return "—";
    return showDates ? formatAppDateTime(date) : formatAppTime(date);
  };

  return `${formatEndpoint(started)} – ${formatEndpoint(ended)}`;
}

export function formatChargeDuration(
  startedAt?: string,
  endedAt?: string
) {
  const started = parseDate(startedAt);
  const ended = parseDate(endedAt);
  if (!started || !ended || ended.getTime() < started.getTime()) return "—";

  const totalMinutes = Math.round(
    (ended.getTime() - started.getTime()) / 60000
  );
  if (totalMinutes < 1) return "Less than 1 min";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
  if (hours > 0) return `${hours} hr`;
  return `${minutes} min`;
}

export function compareChargeTimestamps(
  left: { startedAt?: string },
  right: { startedAt?: string }
) {
  const leftTime = parseDate(left.startedAt)?.getTime();
  const rightTime = parseDate(right.startedAt)?.getTime();
  if (leftTime === undefined) return rightTime === undefined ? 0 : 1;
  if (rightTime === undefined) return -1;
  return leftTime - rightTime;
}

export function useAppDateTimeFormats() {
  const dateFormat = useClubSettingsStore((state) => state.settings.dateFormat);
  const timeFormat = useClubSettingsStore((state) => state.settings.timeFormat);
  return { dateFormat, timeFormat };
}
