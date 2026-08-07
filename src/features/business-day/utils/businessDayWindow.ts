const BUSINESS_DAY_START_HOUR = 6;

export interface BusinessDayWindow {
  start: Date;
  end: Date;
}

export function getBusinessDayWindow(value: string | Date): BusinessDayWindow {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  const start = new Date(date);
  start.setHours(BUSINESS_DAY_START_HOUR, 0, 0, 0);

  if (date.getHours() < BUSINESS_DAY_START_HOUR) {
    start.setDate(start.getDate() - 1);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export function isInsideBusinessDayWindow(
  value: string | undefined,
  window: BusinessDayWindow
) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= window.start.getTime() && time < window.end.getTime();
}

export function isBusinessDayStillCurrent(startedAt: string, now = new Date()) {
  return now.getTime() < getBusinessDayEnd(startedAt).getTime();
}

export function getBusinessDayEnd(startedAt: string | Date) {
  const date = startedAt instanceof Date ? new Date(startedAt) : new Date(startedAt);
  const end = new Date(date);
  end.setHours(BUSINESS_DAY_START_HOUR, 0, 0, 0);

  if (date.getHours() >= BUSINESS_DAY_START_HOUR) {
    end.setDate(end.getDate() + 1);
    return end;
  }

  end.setDate(end.getDate() + 1);
  return end;
}

export function getBusinessDayTransactionWindow(day: {
  startedAt: string;
  endedAt?: string;
}) {
  return {
    start: new Date(day.startedAt),
    end: day.endedAt ? new Date(day.endedAt) : getBusinessDayEnd(day.startedAt),
  };
}
