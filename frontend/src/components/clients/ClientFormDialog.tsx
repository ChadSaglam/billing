import type { Client, CreateClientPayload } from '@/types';
import { useT } from '@/lib/i18n';
import { FormField } from '@/components/shared/FormField';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const EMPTY_CLIENT: CreateClientPayload = {
  customer_number: '',
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  street: '',
  postal_code: '',
  city: '',
  country: 'Schweiz',
  notes: '',
};

export { EMPTY_CLIENT };

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingClient: Client | null;
  form: CreateClientPayload;
  onFieldChange: (field: keyof CreateClientPayload, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export function ClientFormDialog({
  open,
  onOpenChange,
  editingClient,
  form,
  onFieldChange,
  onSubmit,
  isPending,
}: ClientFormDialogProps) {
  const isEdit = !!editingClient;
  const { t } = useT();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? t('clients.editClient') : t('clients.new')}</DialogTitle>
            <DialogDescription>
              {isEdit ? t('clients.editDesc') : t('clients.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField id="cf_customer_number" label={t('field.customerNumber')} required value={form.customer_number} onChange={(v) => onFieldChange('customer_number', v)} />
              <FormField id="cf_company_name" label={t('field.companyName')} required value={form.company_name} onChange={(v) => onFieldChange('company_name', v)} />
            </div>
            <FormField id="cf_contact_person" label={t('field.contactPerson')} value={form.contact_person || ''} onChange={(v) => onFieldChange('contact_person', v)} />
            <div className="grid grid-cols-2 gap-4">
              <FormField id="cf_email" label={t('field.email')} type="email" value={form.email || ''} onChange={(v) => onFieldChange('email', v)} />
              <FormField id="cf_phone" label={t('field.phone')} value={form.phone || ''} onChange={(v) => onFieldChange('phone', v)} />
            </div>
            <FormField id="cf_street" label={t('field.street')} required value={form.street} onChange={(v) => onFieldChange('street', v)} />
            <div className="grid grid-cols-3 gap-4">
              <FormField id="cf_postal_code" label={t('field.postalCode')} required value={form.postal_code} onChange={(v) => onFieldChange('postal_code', v)} />
              <FormField id="cf_city" label={t('field.city')} required value={form.city} onChange={(v) => onFieldChange('city', v)} />
              <FormField id="cf_country" label={t('field.country')} value={form.country || ''} onChange={(v) => onFieldChange('country', v)} />
            </div>
            <div className="space-y-2">
              <FormField id="cf_notes" label={t('field.notes')}>
                <Textarea id="cf_notes" value={form.notes || ''} onChange={(e) => onFieldChange('notes', e.target.value)} rows={3} />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('common.saving') : isEdit ? t('clients.updateClient') : t('clients.createClient')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
