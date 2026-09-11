import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { getPortalDocument, downloadPortalPdf } from '@/lib/api';
import { formatCurrency, formatDate, toNum } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared';
import type { LineItem } from '@/types';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function Portal() {
  const { token } = useParams<{ token: string }>();
  const { t } = useT();

  const { data: doc, isLoading, isError } = useQuery({
    queryKey: ['portal', token],
    queryFn: () => getPortalDocument(token!),
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
          <h2 className="text-xl font-semibold mb-2">{t('portal.notFound')}</h2>
          <p className="text-muted-foreground">{t('portal.notFoundDesc')}</p>
        </Card>
      </div>
    );
  }

  const typeLabel = doc.document_type === 'rechnung' ? t('common.rechnung') : t('common.offerte');

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            {doc.company_name && <p className="text-sm text-muted-foreground mb-1">{doc.company_name}</p>}
            <h1 className="text-2xl font-bold">{typeLabel} {doc.document_number}</h1>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <StatusBadge status={doc.status} />
            <Button onClick={() => downloadPortalPdf(token!)}>
              <Download className="h-4 w-4 mr-1" aria-hidden="true" /> {t('portal.downloadPdf')}
            </Button>
          </div>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t('common.date')}</p><p className="font-medium">{formatDate(doc.date)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t('common.dueDate')}</p><p className="font-medium">{formatDate(doc.due_date)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t('portal.paymentTerms')}</p><p className="font-medium">{t('portal.daysCount', { count: doc.payment_terms_days })}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t('common.total')}</p><p className="font-bold text-lg">{doc.currency} {formatCurrency(doc.total)}</p></CardContent></Card>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader><CardTitle>{t('portal.lineItems')}</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm" aria-label={t('docDetail.lineItemsLabel', { number: doc.document_number })}>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="text-left p-2 w-12">{t('portal.pos')}</th>
                  <th scope="col" className="text-left p-2">{t('portal.description')}</th>
                  <th scope="col" className="text-right p-2">{t('portal.qty')}</th>
                  <th scope="col" className="text-left p-2">{t('portal.unit')}</th>
                  <th scope="col" className="text-right p-2">{t('portal.price')}</th>
                  <th scope="col" className="text-right p-2">{t('common.vat')}</th>
                  <th scope="col" className="text-right p-2">{t('common.total')}</th>
                </tr>
              </thead>
              <tbody>
                {doc.line_items.map((item: LineItem) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="p-2">{item.position}</td>
                    <td className="p-2">{item.description}</td>
                    <td className="p-2 text-right tabular-nums">{Number(item.quantity).toFixed(2)}</td>
                    <td className="p-2">{item.unit}</td>
                    <td className="p-2 text-right tabular-nums">{formatCurrency(item.unit_price)}</td>
                    <td className="p-2 text-right tabular-nums">{toNum(item.vat_rate)}%</td>
                    <td className="p-2 text-right tabular-nums">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Separator className="my-4" />
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex justify-between w-64">
                <span className="text-muted-foreground">{t('common.subtotal')}</span>
                <span className="tabular-nums">{formatCurrency(doc.subtotal)}</span>
              </div>
              {toNum(doc.discount_percent) > 0 && (
                <div className="flex justify-between w-64 text-red-600">
                  <span>{t('common.discount')} ({toNum(doc.discount_percent)}%)</span>
                  <span className="tabular-nums">-{formatCurrency(doc.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between w-64">
                <span className="text-muted-foreground">{t('common.vat')}</span>
                <span className="tabular-nums">{formatCurrency(doc.vat_amount)}</span>
              </div>
              <Separator className="w-64 my-1" />
              <div className="flex justify-between w-64 font-bold text-base">
                <span>{t('common.total')}</span>
                <span className="tabular-nums">{doc.currency} {formatCurrency(doc.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {doc.notes && (
          <Card>
            <CardHeader><CardTitle>{t('common.notes')}</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{doc.notes}</p></CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
