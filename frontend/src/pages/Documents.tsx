import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Mail, CheckCircle, Download, ArrowUpRight } from 'lucide-react';
import { getDocumentsPage, bulkUpdateStatus, bulkSendEmail, bulkDownloadPdfZip } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useT, type TKey } from '@/lib/i18n';
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
import { PageHeader, StatusBadge, EmptyState, ErrorState, TableSkeleton } from '@/components/shared';

const PAGE_SIZE = 25;

export default function Documents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useT();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'offerte' | 'rechnung'>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);

  const typeParam = tab === 'all' ? undefined : tab;
  const statusParam = statusFilter === 'all' ? undefined : statusFilter;

  // Page is appended to the key the factory returns so every page gets its
  // own cache entry (R-13).
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...queryKeys.documents.list({ type: typeParam, status: statusParam, search }), page],
    queryFn: () =>
      getDocumentsPage({
        type: typeParam,
        status: statusParam,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });
  const documents = data?.items;

  const bulkStatusMut = useMutation({
    mutationFn: (status: string) => bulkUpdateStatus({ document_ids: [...selected], status }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({ title: t('documents.updated', { count: data.updated }) });
      setSelected(new Set());
    },
  });

  const bulkEmailMut = useMutation({
    mutationFn: () => bulkSendEmail([...selected]),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast({
        title:
          t('documents.emailsQueued', { count: data.queued }) +
          (data.errors.length ? t('documents.emailsFailed', { count: data.errors.length }) : ''),
      });
      setSelected(new Set());
    },
  });

  const bulkZipMut = useMutation({
    mutationFn: () => bulkDownloadPdfZip([...selected]),
    onSuccess: () => {
      toast({ title: t('documents.zipStarted') });
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

  const tabs: { value: 'all' | 'offerte' | 'rechnung'; label: TKey }[] = [
    { value: 'all', label: 'common.all' },
    { value: 'offerte', label: 'common.offerten' },
    { value: 'rechnung', label: 'common.rechnungen' },
  ];

  const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'paid', 'overdue', 'cancelled'] as const;
  const hasFilter = tab !== 'all' || statusFilter !== 'all' || search !== '';
  const resetFilters = () => { setTab('all'); setStatusFilter('all'); setSearch(''); setPage(1); };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('documents.title')}
        description={t('documents.description')}
        actions={
          <div className="flex gap-2">
            <Button onClick={() => navigate('/documents/new?type=offerte')} variant="outline">
              <Plus className="h-4 w-4 mr-1" /> {t('common.newOfferte')}
            </Button>
            <Button onClick={() => navigate('/documents/new?type=rechnung')}>
              <Plus className="h-4 w-4 mr-1" /> {t('common.newRechnung')}
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div role="group" aria-label={t('documents.typeFilter')} className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.value}
            onClick={() => { setTab(tabItem.value); setSelected(new Set()); setPage(1); }}
            aria-pressed={tab === tabItem.value}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === tabItem.value ? 'bg-background shadow-sm' : 'text-foreground/70 hover:text-foreground'
            }`}
          >
            {t(tabItem.label)}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={t('documents.searchPlaceholder')}
            aria-label={t('documents.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]" aria-label={t('documents.statusFilter')}>
            <SelectValue placeholder={t('common.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('documents.allStatus')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 bg-muted rounded-lg border">
          <span className="text-sm font-medium">{t('documents.selected', { count: selected.size })}</span>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button size="sm" variant="outline" onClick={() => bulkEmailMut.mutate()} disabled={bulkEmailMut.isPending}>
              <Mail className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">{t('documents.sendEmail')}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkStatusMut.mutate('paid')} disabled={bulkStatusMut.isPending}>
              <CheckCircle className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">{t('documents.markPaid')}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkZipMut.mutate()} disabled={bulkZipMut.isPending}>
              <Download className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">{t('documents.downloadZip')}</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{t('documents.clear')}</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState error={error} fallback={t('documents.loadFailed')} onRetry={() => refetch()} />
      ) : !documents?.length ? (
        <EmptyState
          preset="documents"
          icon={FileText}
          title={hasFilter ? t('documents.noneFilter') : t('documents.none')}
          description={hasFilter ? t('documents.noneFilterDesc') : t('documents.noneDesc')}
          action={
            <div className="flex gap-2">
              {hasFilter ? (
                <Button variant="outline" onClick={resetFilters}>{t('documents.resetFilters')}</Button>
              ) : (
                <Button variant="outline" onClick={() => navigate('/documents/new?type=offerte')}>
                  <Plus className="h-4 w-4 mr-1" /> {t('common.newOfferte')}
                </Button>
              )}
              <Button onClick={() => navigate('/documents/new?type=rechnung')}>
                <Plus className="h-4 w-4 mr-1" /> {t('common.newRechnung')}
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label={t('documents.tableLabel')}>
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === documents.length && documents.length > 0}
                        onChange={toggleAll}
                        aria-label={t('documents.selectAll')}
                        className="rounded"
                      />
                    </th>
                    <th scope="col" className="p-3 font-medium">{t('common.number')}</th>
                    <th scope="col" className="p-3 font-medium">{t('common.client')}</th>
                    <th scope="col" className="p-3 font-medium">{t('common.date')}</th>
                    <th scope="col" className="p-3 font-medium text-right">{t('common.total')}</th>
                    <th scope="col" className="p-3 font-medium">{t('common.status')}</th>
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
                          aria-label={t('documents.selectDoc', { number: doc.document_number })}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3 font-medium" onClick={() => navigate(`/documents/${doc.id}`)}>
                        <Link to={`/documents/${doc.id}`} className="hover:underline focus-visible:underline" onClick={(e) => e.stopPropagation()}>
                          {doc.document_number}
                        </Link>
                      </td>
                      <td className="p-3 text-muted-foreground" onClick={() => navigate(`/documents/${doc.id}`)}>
                        {doc.client?.company_name || t('documents.noClient')}
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
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
                      <Link to={`/documents/${doc.id}`} className="font-medium" onClick={(e) => e.stopPropagation()}>{doc.document_number}</Link>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[60%]">
                      {doc.client?.company_name || t('documents.noClient')}
                    </span>
                    <span className="font-medium tabular-nums">{formatCurrency(doc.total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(doc.date)}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination footer (R-13) */}
          {data && data.total > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {data.total === 1 ? t('documents.countOne') : t('documents.countMany', { count: data.total })} ·{' '}
                {t('common.pageOf', { page: data.page, pages: Math.max(1, Math.ceil(data.total / data.page_size)) })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * data.page_size >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
