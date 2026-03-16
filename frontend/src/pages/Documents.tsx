import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText } from 'lucide-react';
import { getDocuments } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function Documents() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');

  const typeParam = tab === 'all' ? undefined : tab;
  const statusParam = statusFilter === 'all' ? undefined : statusFilter;

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', { type: typeParam, status: statusParam, search }],
    queryFn: () =>
      getDocuments({
        type: typeParam,
        status: statusParam,
        search: search || undefined,
      }),
  });

  const renderDocsTable = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i: number) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      );
    }

    if (!documents || documents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg">No documents found</p>
          <p className="text-sm">Try adjusting your filters or create a new document</p>
        </div>
      );
    }

    return (
      <div className="rounded-lg border">
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
            {documents.map((doc) => (
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
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-1">Manage offerten and rechnungen</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/documents/new?type=offerte')}>
            <Plus className="mr-2 h-4 w-4" />
            New Offerte
          </Button>
          <Button variant="outline" onClick={() => navigate('/documents/new?type=rechnung')}>
            <Plus className="mr-2 h-4 w-4" />
            New Rechnung
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="offerte">Offerten</TabsTrigger>
            <TabsTrigger value="rechnung">Rechnungen</TabsTrigger>
          </TabsList>

          <div className="flex gap-3 flex-1">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
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
        </div>

        <TabsContent value="all">
          {renderDocsTable()}
        </TabsContent>
        <TabsContent value="offerte">
          {renderDocsTable()}
        </TabsContent>
        <TabsContent value="rechnung">
          {renderDocsTable()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
