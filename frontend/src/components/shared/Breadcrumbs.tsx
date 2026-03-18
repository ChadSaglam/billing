import { Link, useParams, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumbs() {
  const params = useParams<{ id?: string }>();
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  const crumbs: Crumb[] = [{ label: "Home", to: "/" }];

  if (segments[0] === "clients") {
    crumbs.push({ label: "Clients", to: "/clients" });
    if (params.id) crumbs.push({ label: `Client #${params.id}` });
  } else if (segments[0] === "documents") {
    crumbs.push({ label: "Documents", to: "/documents" });
    if (segments[1] === "new") {
      crumbs.push({ label: "New" });
    } else if (params.id) {
      const isEdit = segments.includes("edit");
      crumbs.push({ label: `#${params.id}`, to: `/documents/${params.id}` });
      if (isEdit) crumbs.push({ label: "Edit" });
    }
  } else if (segments[0] === "settings") {
    crumbs.push({ label: "Settings" });
  }

  if (crumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          {crumb.to && i < crumbs.length - 1 ? (
            <Link to={crumb.to} className="hover:text-foreground transition-colors">
              {i === 0 ? <Home className="h-3.5 w-3.5" /> : crumb.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">
              {i === 0 ? <Home className="h-3.5 w-3.5" /> : crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
