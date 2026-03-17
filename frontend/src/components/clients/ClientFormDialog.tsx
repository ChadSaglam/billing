import type { Client, CreateClientPayload } from '@/types';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Client' : 'New Client'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update the client information below.' : 'Fill in the details to create a new client.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Customer Number" required value={form.customer_number} onChange={(v) => onFieldChange('customer_number', v)} />
              <FormField label="Company Name" required value={form.company_name} onChange={(v) => onFieldChange('company_name', v)} />
            </div>
            <FormField label="Contact Person" value={form.contact_person || ''} onChange={(v) => onFieldChange('contact_person', v)} />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Email" type="email" value={form.email || ''} onChange={(v) => onFieldChange('email', v)} />
              <FormField label="Phone" value={form.phone || ''} onChange={(v) => onFieldChange('phone', v)} />
            </div>
            <FormField label="Street" required value={form.street} onChange={(v) => onFieldChange('street', v)} />
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Postal Code" required value={form.postal_code} onChange={(v) => onFieldChange('postal_code', v)} />
              <FormField label="City" required value={form.city} onChange={(v) => onFieldChange('city', v)} />
              <FormField label="Country" value={form.country || ''} onChange={(v) => onFieldChange('country', v)} />
            </div>
            <div className="space-y-2">
              <FormField label="Notes">
                <Textarea value={form.notes || ''} onChange={(e) => onFieldChange('notes', e.target.value)} rows={3} />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Update Client' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
