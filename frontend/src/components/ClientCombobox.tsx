import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { getClients, createClient } from '@/lib/api';
import type { CreateClientPayload } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const emptyClient: CreateClientPayload = {
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

interface ClientComboboxProps {
  value: string;
  onChange: (clientId: string) => void;
}

export function ClientCombobox({ value, onChange }: ClientComboboxProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateClientPayload>(emptyClient);

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => getClients(),
  });

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onChange(String(newClient.id));
      setDialogOpen(false);
      setForm(emptyClient);
      toast({ title: 'Client created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create client', variant: 'destructive' });
    },
  });

  const selectedClient = clients?.find((c) => String(c.id) === value);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const updateField = (field: keyof CreateClientPayload, val: string) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selectedClient
              ? `${selectedClient.company_name} (${selectedClient.customer_number})`
              : 'Select a client...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search clients..." />
            <CommandList>
              <CommandEmpty>No clients found.</CommandEmpty>
              <CommandGroup>
                {clients?.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`${client.company_name} ${client.customer_number}`}
                    onSelect={() => {
                      onChange(String(client.id));
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === String(client.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{client.company_name}</span>
                      <span className="text-xs text-muted-foreground">{client.customer_number}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Client
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Client</DialogTitle>
            <DialogDescription>Fill in the details to create a new client.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cb_customer_number">Customer Number</Label>
                <Input
                  id="cb_customer_number"
                  value={form.customer_number}
                  onChange={(e) => updateField('customer_number', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cb_company_name">Company Name</Label>
                <Input
                  id="cb_company_name"
                  value={form.company_name}
                  onChange={(e) => updateField('company_name', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cb_contact_person">Contact Person</Label>
                <Input
                  id="cb_contact_person"
                  value={form.contact_person || ''}
                  onChange={(e) => updateField('contact_person', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cb_email">Email</Label>
                <Input
                  id="cb_email"
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => updateField('email', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cb_phone">Phone</Label>
              <Input
                id="cb_phone"
                value={form.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cb_street">Street</Label>
              <Input
                id="cb_street"
                value={form.street}
                onChange={(e) => updateField('street', e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cb_postal_code">Postal Code</Label>
                <Input
                  id="cb_postal_code"
                  value={form.postal_code}
                  onChange={(e) => updateField('postal_code', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cb_city">City</Label>
                <Input
                  id="cb_city"
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cb_country">Country</Label>
                <Input
                  id="cb_country"
                  value={form.country || 'Schweiz'}
                  onChange={(e) => updateField('country', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cb_notes">Notes</Label>
              <Textarea
                id="cb_notes"
                value={form.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
