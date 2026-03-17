import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Clock, AlertTriangle, Users, Plus, FileText } from 'lucide-react';
import { getDashboard } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: getDashboard,
  });

  const statCards = [
    { title: 'Total Revenue', value: data ? formatCurrency(data.total_revenue) : '-', icon: DollarSign, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    { title: 'Outstanding', value: data ? formatCurrency(data.outstanding) : '-', icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { title: 'Overdue', value: data ? String(data.overdue_count) : '-', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
    { title: 'Total Clients', value: data ? String(data.total_clients) : '-', icon: Users, color: 'text-foreground', bg: 'bg-muted' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your billing activity"
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

      {data && data.overdue_count > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-800 dark:text-red-300">
              {data.overdue_count} overdue {data.overdue_count === 1 ? 'document' : 'documents'}
            </p>
            <p className="text-sm text-red-600 dark:text-red-400">
              Outstanding amount requires attention
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/documents?status=overdue')}
            className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300">
            View All
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-center gap-4">
                  <div className={`rounded-lg p-3 ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : data?.recent_documents?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_documents.map((doc) => (
                  <TableRow key={doc.id} className="cursor-pointer" onClick={() => navigate(`/documents/${doc.id}`)}>
                    <TableCell className="font-mono">{doc.document_number}</TableCell>
                    <TableCell>{doc.client?.company_name || '-'}</TableCell>
                    <TableCell>{formatDate(doc.date)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(doc.total)}</TableCell>
                    <TableCell><StatusBadge status={doc.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Create your first offerte or rechnung to get started"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
