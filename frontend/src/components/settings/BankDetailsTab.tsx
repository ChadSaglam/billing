import type { CompanySettings } from '@/types';
import { FormField } from '@/components/shared/FormField';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface BankDetailsTabProps {
  form: Partial<CompanySettings>;
  onFieldChange: (field: keyof CompanySettings, value: string | number) => void;
}

export function BankDetailsTab({ form, onFieldChange }: BankDetailsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Details</CardTitle>
        <CardDescription>Used for payment information on invoices</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="Bank Name" value={form.bank_name || ''} onChange={(v) => onFieldChange('bank_name', v)} />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="IBAN" value={form.iban || ''} onChange={(v) => onFieldChange('iban', v)} />
          <FormField label="BIC/Swift" value={form.bic || ''} onChange={(v) => onFieldChange('bic', v)} />
        </div>
      </CardContent>
    </Card>
  );
}
