import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

const WIDTHS = ["w-full", "w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-1/3"];

export function TableSkeleton({ rows = 5, columns = 6 }: TableSkeletonProps) {
  return (
    <div className="space-y-3 animate-in fade-in-0 duration-300">
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, j) => (
          <Skeleton key={j} className="h-8 flex-1 rounded-md" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4" style={{ opacity: 1 - i * 0.12 }}>
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className={`h-10 flex-1 ${WIDTHS[(i + j) % WIDTHS.length]}`} />
          ))}
        </div>
      ))}
    </div>
  );
}