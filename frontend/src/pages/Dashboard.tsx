import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Clock,
  AlertTriangle,
  Users,
  Plus,
  FileText,
} from 'lucide-react';
import { getDashboard } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  const statCards = [
    {
      title: 'Total Revenue',
      value: data ? formatCurrency(data.total_revenue) : '-',
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      title: 'Outstanding',
      value: data ? formatCurrency(data.outstanding) : '-',
      icon: Clock,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: 'Overdue',
      value: data ? String(data.overdue_count) : '-',
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
    },
    {
      title: 'Total Clients',
      value: data ? String(data.total_clients) : '-',
      icon: Users,
      color: 'text-foreground',
      bg: 'bg-muted',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your billing activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/documents/new?type=offerte')}>
            <Plus className="mr-2 h-4 w-4" />
            New Offerte
          </Button>
          <Button onClick={() => navigate('/documents/new?type=rechnung')} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            New Rechnung
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) =>
          isLoading ? (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ) : (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-full p-2 ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* Recent documents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Documents</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data?.recent_documents && data.recent_documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {doc.document_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{doc.client?.company_name || '-'}</TableCell>
                    <TableCell>{formatDate(doc.date)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(doc.total)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(doc.status)}>
                        {getStatusLabel(doc.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-40" />
              <p>No documents yet</p>
              <p className="text-sm">Create your first offerte or rechnung to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
