const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toDateInputValue(date: Date) {
  return isoDateFormatter.format(date);
}

export function getMonday(date = new Date()) {
  const copy = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy;
}

export function getCurrentWeekStart() {
  return toDateInputValue(getMonday());
}

export function isMondayDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1;
}

export function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date "${value}".`);
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatWeekLabel(value: string) {
  return formatDateLabel(value);
}

export function formatOptionalDateLabel(
  value: string | null,
  emptyLabel = "No deadline",
) {
  if (value === null) {
    return emptyLabel;
  }

  return formatDateLabel(value);
}
