import { format, parseISO } from "date-fns";

/**
 * Format a `last_worked_on` value for display. The value may be a date
 * (`YYYY-MM-DD`) or a datetime (`YYYY-MM-DDTHH:MM`); the time is shown only
 * when present, so date-only cards read exactly as before.
 */
export function formatWorkedOn(value: string): string {
  const date = parseISO(value);
  return value.includes("T")
    ? format(date, "MMM d, yyyy 'at' h:mm a")
    : format(date, "MMM d, yyyy");
}
