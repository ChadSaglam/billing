import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchDocumentPreviewUrl, getDocuments } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useT, type TKey } from '@/lib/i18n';

const templates: { id: string; name: TKey; description: TKey }[] = [
  { id: 'modern', name: 'settings.templateModern', description: 'settings.templateModernDesc' },
  { id: 'classic', name: 'settings.templateClassic', description: 'settings.templateClassicDesc' },
];

interface Props {
  value: string;
  onChange: (template: string) => void;
}

export function TemplatesTab({ value, onChange }: Props) {
  const { t } = useT();
  const [, setPreviewTemplate] = useState<string | null>(null);

  const handlePreview = async (templateId: string) => {
    try {
      const docs = await getDocuments({ type: 'rechnung' });
      const docId = docs[0]?.id;
      if (!docId) {
        toast({ title: t('settings.templateNoInvoice'), variant: 'destructive' });
        return;
      }
      setPreviewTemplate(templateId);
      // Object URL: the token travels in the Authorization header, not the URL.
      const url = await fetchDocumentPreviewUrl(docId, templateId);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast({ title: t('settings.templatePreviewFailed'), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('settings.templatesIntro')}
      </p>
      <div role="radiogroup" aria-label={t('settings.tabTemplates')} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => (
          <Card
            key={tpl.id}
            role="radio"
            aria-checked={value === tpl.id}
            aria-label={t('settings.templateSelect', { name: t(tpl.name) })}
            tabIndex={0}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === tpl.id
                ? 'ring-2 ring-primary border-primary'
                : 'hover:border-muted-foreground/30'
            )}
            onClick={() => onChange(tpl.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(tpl.id); }
            }}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      value === tpl.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold">{t(tpl.name)}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(tpl.description)}
                    </p>
                  </div>
                </div>
                {value === tpl.id && (
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                    {t('settings.templateActive')}
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
                  handlePreview(tpl.id);
                }}
              >
                <Eye className="h-4 w-4 mr-2" aria-hidden="true" />
                {t('docDetail.preview')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
