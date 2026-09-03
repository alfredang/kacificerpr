import { format, formatDistanceToNowStrict } from "date-fns";

export function money(value: number | string | null | undefined, currency = "USD") {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export function num(value: number | string | null | undefined) {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("en-US").format(n);
}

export function dateShort(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "d MMM yyyy");
}

export function dateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "d MMM yyyy, HH:mm");
}

export function ago(d: Date | string | null | undefined) {
  if (!d) return "—";
  return formatDistanceToNowStrict(new Date(d), { addSuffix: true });
}

export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
