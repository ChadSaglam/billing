import { useEffect, useState } from "react";
import { X, ExternalLink, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadDocumentPdf } from "@/lib/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

interface PreviewPanelProps {
  documentId: number;
  documentNumber: string;
  documentType: string;
  open: boolean;
  onClose: () => void;
}

function PreviewContent({ documentId, documentNumber, documentType, onClose }: Omit<PreviewPanelProps, 'open'>) {
  const token = localStorage.getItem("auth_token");
  const previewUrl = `${API_URL}/api/documents/${documentId}/preview?token=${token}`;
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div className="flex items-center justify-between px-4 h-14 border-b">
        <h2 className="text-sm font-medium">Preview {documentNumber}</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => downloadDocumentPdf(documentId, documentNumber, documentType)}
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => window.open(previewUrl, "_blank")}
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!iframeLoaded && (
        <div className="flex items-center justify-center h-[calc(100%-3.5rem)]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Generating PDF…</p>
          </div>
        </div>
      )}

      <iframe
        src={previewUrl}
        className={cn("w-full h-[calc(100%-3.5rem)]", !iframeLoaded && "hidden")}
        onLoad={() => setIframeLoaded(true)}
        title={`Preview ${documentNumber}`}
      />
    </>
  );
}

export default function PreviewPanel({
  documentId, documentNumber, documentType, open, onClose,
}: PreviewPanelProps) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-background border-l shadow-lg transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {open && (
          <PreviewContent
            documentId={documentId}
            documentNumber={documentNumber}
            documentType={documentType}
            onClose={onClose}
          />
        )}
      </div>
    </>
  );
}