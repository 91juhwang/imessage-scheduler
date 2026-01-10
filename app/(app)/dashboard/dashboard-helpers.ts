import { getStatusBadgeClass } from "@/app/lib/status-badge";

function formatDateTime(dateString: string | null) {
  if (!dateString) {
    return "";
  }
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function truncate(value: string | null, length = 40) {
  if (!value) {
    return "";
  }
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length)}…`;
}

export { formatDateTime, getStatusBadgeClass, truncate };
