import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Clock, AlertTriangle, Users, Plus, FileText,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { getDashboard } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useT, statusLabel } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageHeader, StatusBadge, EmptyState, ErrorState, PageSkeleton } from '@/components/shared';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  sent: '#3b82f6',
  accepted: '#22c55e',
  rejected: '#ef4444',
  paid: '#16a34a',
  overdue: '#f97316',
  cancelled: '#a1a1aa',
};

function formatMonth(month: string) {
  const [y, m] = month.split('-');
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString('de-CH', { month: 'short', year: '2-digit' });
}

interface TooltipPayloadEntry {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

function ChartTooltipContent({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: TooltipPayloadEntry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium tabular-nums">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, locale } = useT();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: getDashboard,
  });

  const statCards = [
    { title: t('dashboard.totalRevenue'), value: data ? formatCurrency(data.total_revenue) : '-', icon: DollarSign, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    { title: t('dashboard.outstanding'), value: data ? formatCurrency(data.outstanding) : '-', icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { title: t('dashboard.overdue'), value: data ? String(data.overdue_count) : '-', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
    { title: t('dashboard.totalClients'), value: data ? String(data.total_clients) : '-', icon: Users, color: 'text-foreground', bg: 'bg-muted' },
  ];

  const revenueData = (data?.monthly_revenue ?? []).map((m) => ({
    month: formatMonth(m.month),
    [t('dashboard.revenue')]: Number(m.revenue),
    [t('dashboard.outstanding')]: Number(m.outstanding),
  }));

  const statusData = (data?.status_distribution ?? [])
    .filter((s) => s.count > 0)
    .map((s) => ({
      name: statusLabel(s.status, locale),
      value: s.count,
      color: STATUS_COLORS[s.status] ?? '#94a3b8',
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description')}
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

      {isError ? (
        <ErrorState error={error} fallback={t('dashboard.loadFailed')} onRetry={() => refetch()} />
      ) : isLoading ? (
        <PageSkeleton variant="dashboard" header={false} />
      ) : (
        <>
          {/* Overdue Alert */}
          {data && data.overdue_count > 0 && (
            <div
              className="flex items-center gap-3 p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              onClick={() => navigate('/documents?status=overdue')}
            >
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-300">
                  {data.overdue_count === 1 ? t('dashboard.overdueOne') : t('dashboard.overdueMany', { count: data.overdue_count })}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">{t('dashboard.overdueHint')}</p>
              </div>
            </div>
          )}

          {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label={t('dashboard.kpis')}>
              {statCards.map((stat) => (
                <Card key={stat.title}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.title}</p>
                      <p className="text-xl font-bold tabular-nums">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

          {/* Charts Row */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Revenue Bar Chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('dashboard.monthlyRevenue')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueData.length === 0 ? (
                    <div className="flex items-center justify-center h-60 text-muted-foreground text-sm">
                      {t('dashboard.noInvoiceData')}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={revenueData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey={t('dashboard.revenue')} fill="#16a34a" radius={[3, 3, 0, 0]} />
                        <Bar dataKey={t('dashboard.outstanding')} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Status Donut */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('dashboard.documentStatus')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusData.length === 0 ? (
                    <div className="flex items-center justify-center h-60 text-muted-foreground text-sm">
                      {t('dashboard.noDocuments')}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {statusData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => [t('dashboard.docs', { count: String(value) }), `${name}`]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                        {statusData.map((s) => (
                          <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                            {s.name} ({s.value})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          {/* Recent Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{t('dashboard.recentDocuments')}</CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.recent_documents?.length ? (
                <EmptyState
                  icon={FileText}
                  title={t('dashboard.noDocuments')}
                  description={t('dashboard.noDocumentsDesc')}
                  action={
                    <Button onClick={() => navigate('/documents/new?type=rechnung')}>
                      <Plus className="h-4 w-4 mr-1" /> {t('common.newRechnung')}
                    </Button>
                  }
                />
              ) : (
                <Table aria-label={t('dashboard.recentDocuments')}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.number')}</TableHead>
                      <TableHead>{t('common.client')}</TableHead>
                      <TableHead>{t('common.date')}</TableHead>
                      <TableHead className="text-right">{t('common.total')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recent_documents.map((doc) => (
                      <TableRow
                        key={doc.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <TableCell className="font-medium">{doc.document_number}</TableCell>
                        <TableCell className="text-muted-foreground">{doc.client?.company_name ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(doc.date)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(doc.total)}</TableCell>
                        <TableCell><StatusBadge status={doc.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
