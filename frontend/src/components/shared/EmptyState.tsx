import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

type Preset = "documents" | "clients" | "dashboard" | "generic";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  preset?: Preset;
}

function FloatingIllustration({ preset }: { preset: Preset }) {
  if (preset === "documents")
    return (
      <svg viewBox="0 0 120 120" className="h-24 w-24 animate-float" fill="none">
        <rect x="25" y="15" width="70" height="90" rx="6" className="stroke-muted-foreground/30" strokeWidth="2" />
        <line x1="40" y1="40" x2="80" y2="40" className="stroke-muted-foreground/20" strokeWidth="2" strokeLinecap="round" />
        <line x1="40" y1="52" x2="72" y2="52" className="stroke-muted-foreground/20" strokeWidth="2" strokeLinecap="round" />
        <line x1="40" y1="64" x2="65" y2="64" className="stroke-muted-foreground/20" strokeWidth="2" strokeLinecap="round" />
        <circle cx="85" cy="80" r="18" className="fill-primary/10 stroke-primary/40" strokeWidth="2" />
        <path d="M80 80l4 4 8-8" className="stroke-primary/60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

  if (preset === "clients")
    return (
      <svg viewBox="0 0 120 120" className="h-24 w-24 animate-float" fill="none">
        <circle cx="45" cy="40" r="14" className="stroke-muted-foreground/30" strokeWidth="2" />
        <path d="M25 85c0-11 9-20 20-20s20 9 20 20" className="stroke-muted-foreground/20" strokeWidth="2" strokeLinecap="round" />
        <circle cx="78" cy="45" r="11" className="stroke-primary/40" strokeWidth="2" />
        <path d="M62 88c0-9 7-16 16-16s16 7 16 16" className="stroke-primary/30" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );

  if (preset === "dashboard")
    return (
      <svg viewBox="0 0 120 120" className="h-24 w-24 animate-float" fill="none">
        <rect x="15" y="70" width="18" height="35" rx="3" className="fill-muted-foreground/15" />
        <rect x="40" y="50" width="18" height="55" rx="3" className="fill-primary/20" />
        <rect x="65" y="30" width="18" height="75" rx="3" className="fill-primary/30" />
        <rect x="90" y="55" width="18" height="50" rx="3" className="fill-muted-foreground/15" />
        <path d="M24 68 l25-20 25 10 25-25" className="stroke-primary/50" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    );

  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24 animate-float" fill="none">
      <rect x="20" y="25" width="80" height="70" rx="8" className="stroke-muted-foreground/25" strokeWidth="2" />
      <circle cx="60" cy="55" r="16" className="stroke-primary/40" strokeWidth="2" />
      <path d="M54 55l4 4 8-8" className="stroke-primary/60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyState({ icon: Icon, title, description, action, preset = "generic" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <FloatingIllustration preset={preset} />
      {Icon && preset === "generic" && (
        <div className="rounded-full bg-muted p-4 mb-4 mt-2">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-medium mt-4">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}