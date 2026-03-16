import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { getServices, createService, updateService, deleteService } from '@/lib/api';
import type { ServiceTemplate, CreateServicePayload } from '@/types';
import { formatCurrency, toNum } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const emptyService: CreateServicePayload = {
  name: '',
  category: 'Development',
  description: '',
  unit: 'Stunde',
  default_price: 0,
  is_active: true,
  sort_order: 0,
};

interface ServiceManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServiceManager({ open, onOpenChange }: ServiceManagerProps) {
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceTemplate | null>(null);
  const [form, setForm] = useState<CreateServicePayload>(emptyService);

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: getServices,
  });

  const createMut = useMutation({
    mutationFn: createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setEditDialogOpen(false);
      toast({ title: 'Service created' });
    },
    onError: () => {
      toast({ title: 'Failed to create service', variant: 'destructive' });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateServicePayload> }) =>
      updateService(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setEditDialogOpen(false);
      toast({ title: 'Service updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update service', variant: 'destructive' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({ title: 'Service deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete service', variant: 'destructive' });
    },
  });

  const openCreate = () => {
    setEditingService(null);
    setForm(emptyService);
    setEditDialogOpen(true);
  };

  const openEdit = (svc: ServiceTemplate) => {
    setEditingService(svc);
    setForm({
      name: svc.name,
      category: svc.category,
      description: svc.description,
      unit: svc.unit,
      default_price: toNum(svc.default_price),
      is_active: svc.is_active,
      sort_order: svc.sort_order,
    });
    setEditDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingService) {
      updateMut.mutate({ id: editingService.id, payload: form });
    } else {
      createMut.mutate(form);
    }
  };

  const handleToggleActive = (svc: ServiceTemplate) => {
    updateMut.mutate({ id: svc.id, payload: { is_active: !svc.is_active } });
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Delete this service?')) {
      deleteMut.mutate(id);
    }
  };

  const updateField = (field: keyof CreateServicePayload, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Services</DialogTitle>
            <DialogDescription>
              Add, edit, or remove service templates used in documents.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          </div>

          {services && services.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((svc) => (
                    <TableRow key={svc.id}>
                      <TableCell className="font-medium">{svc.name}</TableCell>
                      <TableCell>{svc.category}</TableCell>
                      <TableCell>{svc.unit}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(svc.default_price)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={svc.is_active ? 'default' : 'secondary'}
                          className="cursor-pointer"
                          onClick={() => handleToggleActive(svc)}
                        >
                          {svc.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(svc)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(svc.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <p>No services yet. Add your first service template.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Edit Service' : 'New Service'}</DialogTitle>
            <DialogDescription>
              {editingService ? 'Update the service details.' : 'Create a new service template.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => updateField('unit', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Stunde">Stunde</SelectItem>
                    <SelectItem value="Stück">Stück</SelectItem>
                    <SelectItem value="Pauschal">Pauschal</SelectItem>
                    <SelectItem value="Monat">Monat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Price (CHF)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.default_price}
                  onChange={(e) => updateField('default_price', Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sort_order ?? 0}
                  onChange={(e) => updateField('sort_order', Number(e.target.value))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingService ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
