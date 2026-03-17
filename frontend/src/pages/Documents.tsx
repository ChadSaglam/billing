import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, ArrowUpRight } from 'lucide-react';
import { getDocuments } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PageHeader, StatusBadge, EmptyState, TableSkeleton } from '@/components/shared';

export default function Documents() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'offerte' | 'rechnung'>('all');

  const typeParam = tab === 'all' ? undefined : tab;
  const statusParam = statusFilter === 'all' ? undefined : statusFilter;

  const { data: documents, isLoading } = useQuery({
    queryKey: queryKeys.documents.list({ type: typeParam, status: statusParam, search }),
    queryFn: () => getDocuments({ type: typeParam, status: statusParam, search: search || undefined }),
  });

  const tabs: { value: 'all' | 'offerte' | 'rechnung'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'offerte', label: 'Offerten' },
    { value: 'rechnung', label: 'Rechnungen' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Manage offerten and rechnungen"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/documents/new?type=offerte')}>
              <Plus className="mr-2 h-4 w-4" />New Offerte
            </Button>
            <Button onClick={() => navigate('/documents/new?type=rechnung')}>
              <Plus className="mr-2 h-4 w-4" />New Rechnung
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex h-9 items-center rounded-lg border bg-muted p-1 text-muted-foreground">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${
                tab === t.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {['draft', 'sent', 'accepted', 'rejected', 'paid', 'overdue', 'cancelled'].map((s) => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : !documents?.length ? (
        <EmptyState
          icon={FileText}
          title="No documents found"
          description="Try adjusting your filters or create a new document"
        />
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <Card
              key={doc.id}
              className="group cursor-pointer transition-all duration-150 hover:shadow-md hover:border-primary/20 active:scale-[0.995]"
              onClick={() => navigate(`/documents/${doc.id}`)}
            >
              <div className="flex items-center gap-4 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  doc.document_type === 'offerte'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                }`}>
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm">{doc.document_number}</span>
                    <span className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 bg-muted rounded">{doc.document_type}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {doc.client?.company_name || 'No client'} · {formatDate(doc.date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-semibold text-sm">{formatCurrency(doc.total)}</p>
                </div>
                <div className="shrink-0"><StatusBadge status={doc.status} /></div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
