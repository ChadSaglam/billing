import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Mail, CheckCircle, Download, ArrowUpRight } from 'lucide-react';
import { getDocuments, bulkUpdateStatus, bulkSendEmail, bulkDownloadPdfZip } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader, StatusBadge, EmptyState, TableSkeleton } from '@/components/shared';

export default function Documents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'offerte' | 'rechnung'>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const typeParam = tab === 'all' ? undefined : tab;
  const statusParam = statusFilter === 'all' ? undefined : statusFilter;

  const { data: documents, isLoading } = useQuery({
    queryKey: queryKeys.documents.list({ type: typeParam, status: statusParam, search }),
    queryFn: () => getDocuments({ type: typeParam, status: statusParam, search: search || undefined }),
  });

  const bulkStatusMut = useMutation({
    mutationFn: (status: string) => bulkUpdateStatus({ document_ids: [...selected], status }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: `${data.updated} documents updated` });
      setSelected(new Set());
    },
  });

  const bulkEmailMut = useMutation({
    mutationFn: () => bulkSendEmail([...selected]),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: `${data.sent} emails sent${data.errors.length ? `, ${data.errors.length} failed` : ''}` });
      setSelected(new Set());
    },
  });

  const bulkZipMut = useMutation({
    mutationFn: () => bulkDownloadPdfZip([...selected]),
    onSuccess: () => {
      toast({ title: 'ZIP download started' });
      setSelected(new Set());
    },
  });

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!documents) return;
    if (selected.size === documents.length) setSelected(new Set());
    else setSelected(new Set(documents.map((d) => d.id)));
  };

  const tabs: { value: 'all' | 'offerte' | 'rechnung'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'offerte', label: 'Offerten' },
    { value: 'rechnung', label: 'Rechnungen' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Manage your Offerten and Rechnungen"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => navigate('/documents/new?type=offerte')} variant="outline">
              <Plus className="h-4 w-4 mr-1" /> New Offerte
            </Button>
            <Button onClick={() => navigate('/documents/new?type=rechnung')}>
              <Plus className="h-4 w-4 mr-1" /> New Rechnung
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => { setTab(t.value); setSelected(new Set()); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 bg-muted rounded-lg border">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button size="sm" variant="outline" onClick={() => bulkEmailMut.mutate()} disabled={bulkEmailMut.isPending}>
              <Mail className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Send Email</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkStatusMut.mutate('paid')} disabled={bulkStatusMut.isPending}>
              <CheckCircle className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Mark Paid</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkZipMut.mutate()} disabled={bulkZipMut.isPending}>
              <Download className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Download ZIP</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : !documents?.length ? (
        <EmptyState
          preset="documents"
          icon={FileText}
          title="No documents yet"
          description="Create your first Offerte or Rechnung to start billing"
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/documents/new?type=offerte')}>
                <Plus className="h-4 w-4 mr-1" /> New Offerte
              </Button>
              <Button onClick={() => navigate('/documents/new?type=rechnung')}>
                <Plus className="h-4 w-4 mr-1" /> New Rechnung
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === documents.length && documents.length > 0}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <th className="p-3 font-medium">Number</th>
                    <th className="p-3 font-medium">Client</th>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium text-right">Total</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3 font-medium" onClick={() => navigate(`/documents/${doc.id}`)}>
                        {doc.document_number}
                      </td>
                      <td className="p-3 text-muted-foreground" onClick={() => navigate(`/documents/${doc.id}`)}>
                        {doc.client?.company_name || 'No client'}
                      </td>
                      <td className="p-3 text-muted-foreground" onClick={() => navigate(`/documents/${doc.id}`)}>
                        {formatDate(doc.date)}
                      </td>
                      <td className="p-3 text-right font-medium tabular-nums" onClick={() => navigate(`/documents/${doc.id}`)}>
                        {formatCurrency(doc.total)}
                      </td>
                      <td className="p-3" onClick={() => navigate(`/documents/${doc.id}`)}>
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="p-3" onClick={() => navigate(`/documents/${doc.id}`)}>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{doc.document_number}</span>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[60%]">
                      {doc.client?.company_name || 'No client'}
                    </span>
                    <span className="font-medium tabular-nums">{formatCurrency(doc.total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(doc.date)}</p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
