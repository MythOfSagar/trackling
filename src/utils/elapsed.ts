const dayMilliseconds = 86_400_000;

function addCalendarMonths(date: Date, months: number) {
  const monthIndex = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const day = Math.min(date.getDate(), new Date(year, month + 1, 0).getDate());
  return new Date(year, month, day, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

function calendarDaysBetween(start: Date, end: Date) {
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const endTime = end.getHours() * 3_600_000 + end.getMinutes() * 60_000 + end.getSeconds() * 1_000 + end.getMilliseconds();
  const startTime = start.getHours() * 3_600_000 + start.getMinutes() * 60_000 + start.getSeconds() * 1_000 + start.getMilliseconds();
  return Math.max(0, Math.floor((endDay - startDay) / dayMilliseconds) - (endTime < startTime ? 1 : 0));
}

export function getElapsedTime(timestamp: string | null, now = Date.now()): string {
  if (!timestamp) return "Nothing recorded yet";
  const elapsed = Math.max(0, now - new Date(timestamp).getTime());
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  const start = new Date(timestamp);
  const end = new Date(now);
  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (months > 0 && addCalendarMonths(start, months).getTime() > end.getTime()) months -= 1;
  if (months >= 1) {
    const anchor = addCalendarMonths(start, months);
    const remainingDays = calendarDaysBetween(anchor, end);
    if (months < 12) {
      const monthLabel = `${months} ${months === 1 ? "month" : "months"}`;
      return remainingDays ? `${monthLabel}, ${remainingDays} ${remainingDays === 1 ? "day" : "days"} ago` : `${monthLabel} ago`;
    }
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const yearLabel = `${years} ${years === 1 ? "year" : "years"}`;
    return remainingMonths ? `${yearLabel}, ${remainingMonths} ${remainingMonths === 1 ? "month" : "months"} ago` : `${yearLabel} ago`;
  }
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  return `${days} days ago`;
}

export function formatLastDate(timestamp: string | null, use24Hour = false) {
  if (!timestamp) return "No entries yet";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hourCycle: use24Hour ? "h23" : "h12" }).format(new Date(timestamp));
}

export function formatClock(timestamp: string, use24Hour = false) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hourCycle: use24Hour ? "h23" : "h12" }).format(new Date(timestamp));
}
