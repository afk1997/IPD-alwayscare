import { format, formatDistanceToNow, differenceInDays, differenceInMinutes } from "date-fns";

const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30

export function toIST(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET);
}

export function formatIST(date: Date, formatStr: string = "dd/MM/yyyy"): string {
  return format(toIST(date), formatStr);
}

export function formatTimeIST(date: Date): string {
  return format(toIST(date), "HH:mm");
}

export function formatDateTimeIST(date: Date): string {
  return format(toIST(date), "dd/MM/yyyy HH:mm");
}

export function formatRelative(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function daysSince(date: Date): number {
  return differenceInDays(new Date(), date);
}

export function minutesSince(date: Date): number {
  return differenceInMinutes(new Date(), date);
}

export function isBathDue(lastBathOrAdmission: Date, dueDays: number = 5): {
  isDue: boolean;
  isOverdue: boolean;
  daysSinceLast: number;
} {
  const days = daysSince(lastBathOrAdmission);
  return {
    isDue: days >= dueDays,
    isOverdue: days > dueDays,
    daysSinceLast: days,
  };
}

export function getTodayIST(): string {
  return format(toIST(new Date()), "yyyy-MM-dd");
}

export function isOverdueByMinutes(scheduledTime: string, minutes: number = 30): boolean {
  const now = toIST(new Date());
  const today = format(now, "yyyy-MM-dd");
  const scheduled = new Date(`${today}T${scheduledTime}:00`);
  return differenceInMinutes(now, scheduled) > minutes;
}
