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
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  const months = Math.floor(days / 30.4375);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.floor(days / 365.25);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

export function formatLastDate(timestamp: string | null, use24Hour = false) {
  if (!timestamp) return "No entries yet";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hourCycle: use24Hour ? "h23" : "h12" }).format(new Date(timestamp));
}

export function formatClock(timestamp: string, use24Hour = false) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hourCycle: use24Hour ? "h23" : "h12" }).format(new Date(timestamp));
}
