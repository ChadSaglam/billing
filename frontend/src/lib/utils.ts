import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Numeric } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toNum(value: Numeric): number {
  return typeof value === "string" ? parseFloat(value) || 0 : value;
}

export function formatCurrency(value: Numeric, currency = "CHF"): string {
  return `${currency} ${toNum(value).toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-CH");
}

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  overdue: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};
