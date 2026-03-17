import type { CompanySettings } from '@/types';
import { FormField } from '@/components/shared/FormField';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { LogoUpload } from '@/components/LogoUpload';

interface CompanyInfoTabProps {
  form: Partial<CompanySettings>;
  onFieldChange: (field: keyof CompanySettings, value: string | number) => void;
}

export function CompanyInfoTab({ form, onFieldChange }: CompanyInfoTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Information</CardTitle>
        <CardDescription>Your business details for invoices and documents</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Company Name" value={form.company_name || ''} onChange={(v) => onFieldChange('company_name', v)} />
          <FormField label="UID" value={form.uid || ''} onChange={(v) => onFieldChange('uid', v)} />
        </div>
        <FormField label="Street" value={form.street || ''} onChange={(v) => onFieldChange('street', v)} />
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Postal Code" value={form.postal_code || ''} onChange={(v) => onFieldChange('postal_code', v)} />
          <FormField label="City" value={form.city || ''} onChange={(v) => onFieldChange('city', v)} />
          <FormField label="Country" value={form.country || ''} onChange={(v) => onFieldChange('country', v)} />
        </div>
        <Separator />
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Email" type="email" value={form.email || ''} onChange={(v) => onFieldChange('email', v)} />
          <FormField label="Phone" value={form.phone || ''} onChange={(v) => onFieldChange('phone', v)} />
          <FormField label="Website" value={form.website || ''} onChange={(v) => onFieldChange('website', v)} />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Logo</Label>
          <LogoUpload value={form.logo_url || null} onChange={(url) => onFieldChange('logo_url', url)} />
        </div>
      </CardContent>
    </Card>
  );
}
