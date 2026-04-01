import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { bg: string; dot: string }> = {
  draft:     { bg: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", dot: "bg-gray-400" },
  sent:      { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", dot: "bg-blue-500" },
  accepted:  { bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", dot: "bg-emerald-500" },
  paid:      { bg: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200", dot: "bg-green-600" },
  rejected:  { bg: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", dot: "bg-red-500" },
  overdue:   { bg: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", dot: "bg-orange-500 animate-pulse" },
  cancelled: { bg: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500", dot: "bg-gray-400" },
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <Badge variant="secondary" className={cn("capitalize font-medium border-0 gap-1.5", style.bg, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}