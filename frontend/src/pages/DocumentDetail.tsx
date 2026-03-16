import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Pencil,
  Send,
  CheckCircle,
  XCircle,
  DollarSign,
  Download,
  ArrowRightLeft,
  Trash2,
  FileText,
  ExternalLink,
} from 'lucide-react';
import {
  getDocument,
  updateDocumentStatus,
  convertDocument,
  deleteDocument,
  getDocumentPdfUrl,
} from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, toNum } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: doc, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(Number(id)),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateDocumentStatus(Number(id), status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Status updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => convertDocument(Number(id)),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Converted to Rechnung' });
      navigate(`/documents/${newDoc.id}`);
    },
    onError: () => {
      toast({ title: 'Failed to convert document', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Document deleted' });
      navigate('/documents');
    },
    onError: () => {
      toast({ title: 'Failed to delete document', variant: 'destructive' });
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="text-center py-16">
        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">Document not found</p>
        <Button variant="link" onClick={() => navigate('/documents')}>
          Back to Documents
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/documents')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold tracking-tight">
              {doc.document_number}
            </h1>
            <Badge variant="outline" className="capitalize text-sm">
              {doc.document_type}
            </Badge>
            <Badge className={getStatusColor(doc.status)}>
              {getStatusLabel(doc.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {doc.client?.company_name || 'Unknown Client'}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {doc.status === 'draft' && (
          <>
            <Button variant="outline" onClick={() => navigate(`/documents/${doc.id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button onClick={() => statusMutation.mutate('sent')} disabled={statusMutation.isPending}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </>
        )}
        {doc.status === 'sent' && doc.document_type === 'offerte' && (
          <>
            <Button
              onClick={() => statusMutation.mutate('accepted')}
              disabled={statusMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Accept
            </Button>
            <Button
              variant="destructive"
              onClick={() => statusMutation.mutate('rejected')}
              disabled={statusMutation.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </>
        )}
        {doc.status === 'sent' && doc.document_type === 'rechnung' && (
          <Button
            onClick={() => statusMutation.mutate('paid')}
            disabled={statusMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Mark Paid
          </Button>
        )}
        {doc.status === 'accepted' && doc.document_type === 'offerte' && (
          <Button onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Convert to Rechnung
          </Button>
        )}
        <a href={getDocumentPdfUrl(doc.id)} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </a>
      </div>

      {/* Converted from link */}
      {doc.converted_from_id && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
          <ExternalLink className="h-4 w-4" />
          <span>Converted from Offerte:</span>
          <Link
            to={`/documents/${doc.converted_from_id}`}
            className="text-primary hover:underline font-medium"
          >
            {doc.converted_from?.document_number || `#${doc.converted_from_id}`}
          </Link>
        </div>
      )}

      {/* Document Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="font-medium">
                {doc.client ? (
                  <Link
                    to={`/clients/${doc.client_id}`}
                    className="text-primary hover:underline"
                  >
                    {doc.client.company_name}
                  </Link>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="font-medium">{formatDate(doc.date)}</p>
            </div>
            {doc.due_date && (
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">{formatDate(doc.due_date)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Payment Terms</p>
              <p className="font-medium">{doc.payment_terms_days} days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Pos</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.line_items?.map((item) => (
                <TableRow key={item.id || item.position}>
                  <TableCell className="font-mono text-muted-foreground">
                    {item.position}
                  </TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(item.total_price)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <Separator className="my-4" />
          <div className="flex flex-col items-end space-y-2">
            <div className="flex justify-between w-64 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatCurrency(doc.subtotal)}</span>
            </div>
            {toNum(doc.discount_percent) > 0 && (
              <div className="flex justify-between w-64 text-sm">
                <span className="text-muted-foreground">
                  Discount ({doc.discount_percent}%)
                </span>
                <span className="font-mono text-destructive">
                  -{formatCurrency(doc.discount_amount)}
                </span>
              </div>
            )}
            <Separator className="w-64" />
            <div className="flex justify-between w-64 text-lg font-semibold">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(doc.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {doc.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{doc.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
