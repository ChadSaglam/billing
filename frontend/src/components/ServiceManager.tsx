import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { getServices, createService, updateService, deleteService } from '@/lib/api';
import type { ServiceTemplate, CreateServicePayload } from '@/types';
import { formatCurrency, toNum } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
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
  const { t } = useT();
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
      toast({ title: t('services.created') });
    },
    onError: () => {
      toast({ title: t('services.createFailed'), variant: 'destructive' });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateServicePayload> }) =>
      updateService(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setEditDialogOpen(false);
      toast({ title: t('services.updated') });
    },
    onError: () => {
      toast({ title: t('services.updateFailed'), variant: 'destructive' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({ title: t('services.deleted') });
    },
    onError: () => {
      toast({ title: t('services.deleteFailed'), variant: 'destructive' });
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
    if (window.confirm(t('services.deleteConfirm'))) {
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
            <DialogTitle>{t('services.manage')}</DialogTitle>
            <DialogDescription>
              {t('services.manageDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('services.add')}
            </Button>
          </div>

          {services && services.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('services.name')}</TableHead>
                    <TableHead>{t('services.category')}</TableHead>
                    <TableHead>{t('services.unit')}</TableHead>
                    <TableHead>{t('services.price')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
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
                        <button
                          type="button"
                          onClick={() => handleToggleActive(svc)}
                          aria-pressed={svc.is_active}
                          aria-label={t('services.toggleActive', { name: svc.name })}
                          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Badge variant={svc.is_active ? 'default' : 'secondary'} className="cursor-pointer">
                            {svc.is_active ? t('services.active') : t('services.inactive')}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(svc)} aria-label={t('services.editService', { name: svc.name })}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(svc.id)} aria-label={t('services.deleteService', { name: svc.name })}>
                            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
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
              <p>{t('services.none')}. {t('services.noneDesc')}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingService ? t('services.editTitle') : t('services.newTitle')}</DialogTitle>
            <DialogDescription>
              {editingService ? t('services.editDesc') : t('services.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="svc-name">{t('services.name')}</Label>
              <Input
                id="svc-name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="svc-category">{t('services.category')}</Label>
                <Input
                  id="svc-category"
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label id="svc-unit-label">{t('services.unit')}</Label>
                <Select value={form.unit} onValueChange={(v) => updateField('unit', v)}>
                  <SelectTrigger aria-labelledby="svc-unit-label">
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
              <Label htmlFor="svc-description">{t('services.description')}</Label>
              <Input
                id="svc-description"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="svc-price">{t('services.defaultPrice')}</Label>
                <Input
                  id="svc-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.default_price}
                  onChange={(e) => updateField('default_price', Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-sort">{t('services.sortOrder')}</Label>
                <Input
                  id="svc-sort"
                  type="number"
                  min={0}
                  value={form.sort_order ?? 0}
                  onChange={(e) => updateField('sort_order', Number(e.target.value))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t('common.saving') : editingService ? t('common.update') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
