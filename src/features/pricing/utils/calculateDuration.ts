export interface DurationResult {
  hours: number;
  minutes: number;
  seconds: number;
  totalMinutes: number;
  formatted: string;
}

export function calculateDuration(
  startTime: Date,
  endTime: Date
): DurationResult {
  const diff = Math.max(
    endTime.getTime() - startTime.getTime(),
    0
  );

  const totalSeconds = Math.floor(diff / 1000);

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
    totalMinutes: Math.ceil(diff / 60000),

    formatted: `${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`,
  };
}