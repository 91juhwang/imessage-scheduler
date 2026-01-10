const SLOT_COUNT = 48;
const SLOT_MINUTES = 30;

const SLOT_LABELS = Array.from({ length: SLOT_COUNT }, (_, index) => {
  const totalMinutes = index * SLOT_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours < 12 ? "AM" : "PM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;

  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
});

function padTime(value: number) {
  return value.toString().padStart(2, "0");
}

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateTimeInputValue(date: Date) {
  return [
    date.getFullYear(),
    padTime(date.getMonth() + 1),
    padTime(date.getDate()),
  ].join("-")
    .concat("T")
    .concat(`${padTime(date.getHours())}:${padTime(date.getMinutes())}`);
}

function parseDateTimeInputValue(value: string) {
  if (!value) {
    return null;
  }
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) {
    return null;
  }
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if ([year, month, day, hour, minute].some((entry) => Number.isNaN(entry))) {
    return null;
  }
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function formatIsoWithOffset(date: Date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const offsetHours = padTime(Math.floor(absoluteMinutes / 60));
  const offsetRemainingMinutes = padTime(absoluteMinutes % 60);

  return [
    date.getFullYear(),
    padTime(date.getMonth() + 1),
    padTime(date.getDate()),
  ].join("-")
    .concat("T")
    .concat(
      `${padTime(date.getHours())}:${padTime(date.getMinutes())}:${padTime(
        date.getSeconds()
      )}${sign}${offsetHours}:${offsetRemainingMinutes}`
    );
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTimeInputValue(date: Date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function parseTimeInputValue(baseDate: Date, value: string) {
  if (!value) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  if ([hours, minutes].some((entry) => Number.isNaN(entry))) {
    return null;
  }
  const scheduled = new Date(baseDate);
  scheduled.setHours(hours, minutes, 0, 0);
  return scheduled;
}

function formatDateKey(date: Date) {
  return [
    date.getFullYear(),
    padTime(date.getMonth() + 1),
    padTime(date.getDate()),
  ].join("-");
}

function parseDateKey(value: string | null) {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  if ([year, month, day].some((entry) => Number.isNaN(entry))) {
    return null;
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export {
  SLOT_COUNT,
  SLOT_LABELS,
  SLOT_MINUTES,
  addDays,
  formatDateLabel,
  formatDateKey,
  formatTimeInputValue,
  formatDateTimeInputValue,
  formatIsoWithOffset,
  parseDateKey,
  parseDateTimeInputValue,
  parseTimeInputValue,
  startOfDay,
};
