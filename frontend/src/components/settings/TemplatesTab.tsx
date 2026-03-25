import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const templates = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Farbige Akzente, dunkler Header, alternating Zeilenfarben',
  },
  {
    id: 'classic',
    name: 'Klassisch',
    description: 'Minimalistisch, schwarz-weiss, traditioneller Schweizer Stil',
  },
];

interface Props {
  value: string;
  onChange: (template: string) => void;
}

export function TemplatesTab({ value, onChange }: Props) {
  const [, setPreviewTemplate] = useState<string | null>(null);

  const handlePreview = (templateId: string) => {
    const token = localStorage.getItem('auth_token');
    const url = `${API}/api/documents?document_type=rechnung`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((docs) => {
        const docId = docs[0]?.id;
        if (!docId) {
          alert('Keine Rechnung vorhanden für Vorschau');
          return;
        }
        setPreviewTemplate(templateId);
        window.open(
            `${API}/api/documents/${docId}/preview?template=${templateId}&token=${token}`,
            '_blank'
        );
      });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Wählen Sie die PDF-Vorlage für Ihre Rechnungen und Offerten.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <Card
            key={t.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              value === t.id
                ? 'ring-2 ring-primary border-primary'
                : 'hover:border-muted-foreground/30'
            )}
            onClick={() => onChange(t.id)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      value === t.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  </div>
                </div>
                {value === t.id && (
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                    Aktiv
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(t.id);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Vorschau
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
