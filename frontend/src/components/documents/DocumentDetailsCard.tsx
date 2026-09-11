import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientCombobox } from '@/components/ClientCombobox';
import { FileText, Calendar, Clock, Percent } from 'lucide-react';
import { useT } from '@/lib/i18n';

interface DocumentDetailsCardProps {
  documentType: 'offerte' | 'rechnung';
  onTypeChange: (type: 'offerte' | 'rechnung') => void;
  clientId: string;
  onClientChange: (id: string) => void;
  date: string;
  onDateChange: (date: string) => void;
  paymentTermsDays: number;
  onPaymentTermsChange: (days: number) => void;
  discountPercent: number;
  onDiscountChange: (percent: number) => void;
  isEdit: boolean;
}

export function DocumentDetailsCard({
  documentType, onTypeChange, clientId, onClientChange,
  date, onDateChange, paymentTermsDays, onPaymentTermsChange,
  discountPercent, onDiscountChange, isEdit,
}: DocumentDetailsCardProps) {
  const { t } = useT();
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Top row: Type + Client */}
        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit && (
            <div className="space-y-2">
              <Label id="doc-type-label" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('docForm.documentType')}</Label>
              <div role="group" aria-labelledby="doc-type-label" className="grid grid-cols-2 gap-2">
                {(['offerte', 'rechnung'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onTypeChange(type)}
                    aria-pressed={documentType === type}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                      documentType === type
                        ? type === 'offerte'
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500'
                          : 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500'
                        : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    <span>{type === 'offerte' ? t('common.offerte') : t('common.rechnung')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={`space-y-2 ${isEdit ? 'sm:col-span-2' : ''}`}>
            <Label id="doc-client-label" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('common.client')}</Label>
            <ClientCombobox value={clientId} onChange={onClientChange} labelledBy="doc-client-label" />
          </div>
        </div>

        {/* Bottom row: Date, Payment Terms, Discount */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="doc-date" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="h-3 w-3" aria-hidden="true" /> {t('common.date')}
            </Label>
            <Input id="doc-date" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-payment-terms" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="h-3 w-3" aria-hidden="true" /> {t('docForm.paymentTerms')}
            </Label>
            <div className="relative">
              <Input
                id="doc-payment-terms"
                type="number"
                value={paymentTermsDays}
                onChange={(e) => onPaymentTermsChange(Number(e.target.value))}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{t('common.days')}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-discount" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Percent className="h-3 w-3" aria-hidden="true" /> {t('common.discount')}
            </Label>
            <div className="relative">
              <Input
                id="doc-discount"
                type="number"
                min={0} max={100}
                value={discountPercent}
                onChange={(e) => onDiscountChange(Number(e.target.value))}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
