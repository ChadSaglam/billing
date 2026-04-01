import { Link, useParams, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getClient, getDocument } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumbs() {
  const params = useParams<{ id?: string }>();
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  const isClientRoute = segments[0] === "clients" && !!params.id;
  const isDocRoute = segments[0] === "documents" && !!params.id && segments[1] !== "new";

  const { data: client } = useQuery({
    queryKey: queryKeys.clients.detail(params.id!),
    queryFn: () => getClient(Number(params.id)),
    enabled: isClientRoute,
  });

  const { data: document } = useQuery({
    queryKey: queryKeys.documents.detail(params.id!),
    queryFn: () => getDocument(Number(params.id)),
    enabled: isDocRoute,
  });

  const crumbs: Crumb[] = [{ label: "Home", to: "/" }];

  if (segments[0] === "clients") {
    crumbs.push({ label: "Clients", to: "/clients" });
    if (params.id) {
      crumbs.push({ label: client?.company_name ?? `Client #${params.id}` });
    }
  } else if (segments[0] === "documents") {
    crumbs.push({ label: "Documents", to: "/documents" });
    if (segments[1] === "new") {
      crumbs.push({ label: "New" });
    } else if (params.id) {
      const isEdit = segments.includes("edit");
      const docLabel = document?.document_number ?? `#${params.id}`;
      crumbs.push({ label: docLabel, to: isEdit ? `/documents/${params.id}` : undefined });
      if (isEdit) crumbs.push({ label: "Edit" });
    }
  } else if (segments[0] === "settings") {
    crumbs.push({ label: "Settings" });
  }

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
      {crumbs.map((crumb, i) => (
        <span key={crumb.label + i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          {crumb.to && i < crumbs.length - 1 ? (
            <Link to={crumb.to} className="hover:text-foreground transition-colors">
              {i === 0 ? <Home className="h-4 w-4" aria-label="Home" /> : crumb.label}
            </Link>
          ) : (
            <span className={i === crumbs.length - 1 ? "text-foreground font-medium truncate max-w-[200px]" : ""}>
              {i === 0 ? <Home className="h-4 w-4" /> : crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}