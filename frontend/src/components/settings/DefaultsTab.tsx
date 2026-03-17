import type { CompanySettings } from '@/types';
import { FormField } from '@/components/shared/FormField';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface DefaultsTabProps {
  form: Partial<CompanySettings>;
  onFieldChange: (field: keyof CompanySettings, value: string | number) => void;
}

export function DefaultsTab({ form, onFieldChange }: DefaultsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Defaults</CardTitle>
        <CardDescription>Default values for new documents</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Default Hourly Rate (CHF)" type="number" min={0} step={0.01} value={form.default_hourly_rate as number || ''} onChange={(v) => onFieldChange('default_hourly_rate', Number(v))} />
          <FormField label="Default Payment Terms (days)" type="number" min={0} value={form.default_payment_terms_days || ''} onChange={(v) => onFieldChange('default_payment_terms_days', Number(v))} />
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Next Invoice Number" type="number" min={1} value={form.next_invoice_number || ''} onChange={(v) => onFieldChange('next_invoice_number', Number(v))} />
          <FormField label="Next Offerte Number" type="number" min={1} value={form.next_offerte_number || ''} onChange={(v) => onFieldChange('next_offerte_number', Number(v))} />
        </div>
      </CardContent>
    </Card>
  );
}
