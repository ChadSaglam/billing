import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  FileText, Users, Settings, LayoutDashboard, Plus, Search, Hash,
} from "lucide-react";
import { getClients, getDocuments } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  const { data: clients } = useQuery({
    queryKey: queryKeys.clients.all,
    queryFn: () => getClients(),
    enabled: open,
  });
  const { data: documents } = useQuery({
    queryKey: queryKeys.documents.all,
    queryFn: () => getDocuments(),
    enabled: open,
  });

  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    prevOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const go = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  if (!open) return null;

  // Detect dark mode
  const isDark = document.documentElement.classList.contains("dark");
  const t = {
    bg: isDark ? "#1a1a1a" : "#ffffff",
    fg: isDark ? "#fafafa" : "#0a0a0a",
    border: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
    muted: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
    mutedBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
    hover: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
    selected: isDark ? "#e5e5e5" : "#171717",
    selectedFg: isDark ? "#171717" : "#fafafa",
    selectedMuted: isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.6)",
    kbdBg: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
    kbdBorder: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    shadow: isDark
      ? "0 25px 60px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)"
      : "0 25px 60px -12px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)",
  };

  return createPortal(
    <>
      <style>{`
        .cmd-root { font-family: 'Geist Variable', 'Inter', -apple-system, sans-serif; }
        .cmd-backdrop {
          position: fixed; inset: 0; z-index: 9998;
          background: ${isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)"};
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          animation: cmdIn 120ms ease-out;
        }
        .cmd-wrap {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: flex-start; justify-content: center;
          padding-top: 13vh; padding-left: 16px; padding-right: 16px;
        }
        .cmd-box {
          width: 100%; max-width: 540px;
          background: ${t.bg}; color: ${t.fg};
          border-radius: 14px; border: 1px solid ${t.border};
          box-shadow: ${t.shadow};
          overflow: hidden;
          animation: cmdSlide 180ms cubic-bezier(0.16,1,0.3,1);
        }
        .cmd-search {
          display: flex; align-items: center; gap: 12px;
          padding: 0 18px; border-bottom: 1px solid ${t.border};
        }
        .cmd-search svg { width: 16px; height: 16px; color: ${t.muted}; flex-shrink: 0; }
        .cmd-search input {
          flex: 1; height: 50px; border: none; outline: none;
          background: transparent; font-size: 14px; color: ${t.fg};
          font-family: inherit;
        }
        .cmd-search input::placeholder { color: ${t.muted}; }
        .cmd-esc {
          font-family: ui-monospace, monospace; font-size: 10px;
          padding: 3px 7px; border-radius: 5px;
          background: ${t.kbdBg}; border: 1px solid ${t.kbdBorder};
          color: ${t.muted}; font-weight: 500;
        }
        [cmdk-list] {
          max-height: 320px; overflow-y: auto; overscroll-behavior: contain;
          padding: 6px;
        }
        [cmdk-list]::-webkit-scrollbar { width: 6px; }
        [cmdk-list]::-webkit-scrollbar-thumb {
          background: ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"};
          border-radius: 3px;
        }
        [cmdk-group] { padding-bottom: 2px; }
        [cmdk-group-heading] {
          font-size: 10px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.06em; color: ${t.muted};
          padding: 10px 10px 6px; user-select: none;
        }
        [cmdk-item] {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 8px; cursor: pointer;
          font-size: 13px; transition: all 60ms ease;
          color: ${t.fg};
        }
        [cmdk-item][data-selected="true"] {
          background: ${t.selected}; color: ${t.selectedFg};
        }
        [cmdk-item][data-selected="true"] .ci-sub { color: ${t.selectedMuted}; }
        [cmdk-item][data-selected="true"] .ci-icon {
          background: rgba(255,255,255,0.15) !important;
          color: ${t.selectedFg} !important;
        }
        [cmdk-item][data-selected="true"] .ci-badge { opacity: 0.85; }
        .ci-icon {
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 60ms ease;
        }
        .ci-icon svg { width: 15px; height: 15px; }
        .ci-label { font-weight: 500; line-height: 1.3; }
        .ci-sub { font-size: 11px; color: ${t.muted}; line-height: 1.3; transition: color 60ms ease; }
        .ci-badge {
          font-size: 10px; font-weight: 600; padding: 2px 7px;
          border-radius: 99px; text-transform: capitalize; flex-shrink: 0;
        }
        .cmd-footer {
          display: flex; align-items: center; gap: 14px;
          padding: 8px 18px; border-top: 1px solid ${t.border};
          font-size: 10px; color: ${t.muted}; user-select: none;
        }
        .cmd-footer span { display: flex; align-items: center; gap: 4px; }
        .cmd-footer kbd {
          font-family: ui-monospace, monospace; font-size: 9px;
          padding: 1px 4px; border-radius: 3px;
          background: ${t.kbdBg}; border: 1px solid ${t.kbdBorder};
        }
        [cmdk-empty] {
          display: flex; flex-direction: column; align-items: center;
          padding: 36px 0; color: ${t.muted};
        }
        [cmdk-empty] svg { width: 36px; height: 36px; opacity: 0.25; margin-bottom: 10px; }
        @keyframes cmdIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cmdSlide {
          from { opacity: 0; transform: translateY(-6px) scale(0.99) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>

      <div className="cmd-root">
        <div className="cmd-backdrop" onClick={() => onOpenChange(false)} />
        <div className="cmd-wrap" onClick={() => onOpenChange(false)}>
          <div className="cmd-box" onClick={(e) => e.stopPropagation()}>
            <Command loop>
              <div className="cmd-search">
                <Search />
                <Command.Input
                  ref={inputRef}
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search commands, clients, documents..."
                />
                <span className="cmd-esc">ESC</span>
              </div>

              <Command.List>
                <Command.Empty>
                  <Search />
                  <span style={{ fontWeight: 500, fontSize: 13 }}>No results found</span>
                  <span style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>Try a different search term</span>
                </Command.Empty>

                <Command.Group heading="Quick Actions">
                  <Command.Item onSelect={() => go("/documents/new?type=offerte")}>
                    <div className="ci-icon" style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}><Plus /></div>
                    <div><div className="ci-label">New Offerte</div><div className="ci-sub">Create a new quote</div></div>
                  </Command.Item>
                  <Command.Item onSelect={() => go("/documents/new?type=rechnung")}>
                    <div className="ci-icon" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}><Plus /></div>
                    <div><div className="ci-label">New Rechnung</div><div className="ci-sub">Create a new invoice</div></div>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Navigation">
                  {[
                    { path: "/", label: "Dashboard", desc: "Overview & stats", icon: LayoutDashboard, bg: "rgba(139,92,246,0.1)", fg: "#8b5cf6" },
                    { path: "/documents", label: "Documents", desc: "Invoices & quotes", icon: FileText, bg: "rgba(249,115,22,0.1)", fg: "#f97316" },
                    { path: "/clients", label: "Clients", desc: "Client database", icon: Users, bg: "rgba(6,182,212,0.1)", fg: "#06b6d4" },
                    { path: "/settings", label: "Settings", desc: "Company & preferences", icon: Settings, bg: "rgba(107,114,128,0.1)", fg: "#6b7280" },
                  ].map((item) => (
                    <Command.Item key={item.path} onSelect={() => go(item.path)} value={item.label}>
                      <div className="ci-icon" style={{ background: item.bg, color: item.fg }}><item.icon /></div>
                      <div><div className="ci-label">{item.label}</div><div className="ci-sub">{item.desc}</div></div>
                    </Command.Item>
                  ))}
                </Command.Group>

                {clients && clients.length > 0 && (
                  <Command.Group heading="Clients">
                    {clients.slice(0, 5).map((c) => (
                      <Command.Item key={c.id} onSelect={() => go(`/clients/${c.id}`)} value={`${c.company_name} ${c.customer_number}`}>
                        <div className="ci-icon" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1", fontWeight: 700, fontSize: 13 }}>
                          {c.company_name.charAt(0)}
                        </div>
                        <div><div className="ci-label">{c.company_name}</div><div className="ci-sub">{c.customer_number} · {c.city}</div></div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {documents && documents.length > 0 && (
                  <Command.Group heading="Recent Documents">
                    {documents.slice(0, 5).map((d) => {
                      const isOff = d.document_type === "offerte";
                      const sc: Record<string, { bg: string; fg: string }> = {
                        draft: { bg: "rgba(107,114,128,0.12)", fg: "#6b7280" },
                        sent: { bg: "rgba(59,130,246,0.12)", fg: "#3b82f6" },
                        paid: { bg: "rgba(16,185,129,0.12)", fg: "#10b981" },
                        overdue: { bg: "rgba(239,68,68,0.12)", fg: "#ef4444" },
                        accepted: { bg: "rgba(34,197,94,0.12)", fg: "#22c55e" },
                        rejected: { bg: "rgba(239,68,68,0.12)", fg: "#ef4444" },
                      };
                      const s = sc[d.status] || sc.draft;
                      return (
                        <Command.Item key={d.id} onSelect={() => go(`/documents/${d.id}`)} value={`${d.document_number} ${d.client?.company_name}`}>
                          <div className="ci-icon" style={{ background: isOff ? "rgba(59,130,246,0.1)" : "rgba(34,197,94,0.1)", color: isOff ? "#3b82f6" : "#22c55e" }}><Hash /></div>
                          <div style={{ flex: 1 }}><div className="ci-label">{d.document_number}</div><div className="ci-sub">{d.client?.company_name} · <span style={{ textTransform: "capitalize" }}>{d.document_type}</span></div></div>
                          <div className="ci-badge" style={{ background: s.bg, color: s.fg }}>{d.status}</div>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}
              </Command.List>

              <div className="cmd-footer">
                <span><kbd>↑↓</kbd> Navigate</span>
                <span><kbd>↵</kbd> Open</span>
                <span><kbd>Esc</kbd> Close</span>
              </div>
            </Command>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
