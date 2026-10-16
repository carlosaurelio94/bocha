import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quote } from '@/types';
import { PRODUCT_NAME } from '@/lib/brand';
import { formatDate } from './utils';

/**
 * `companyName` es la empresa dueña del presupuesto: cada tenant tiene que ver
 * SU nombre en el PDF que le manda al cliente. Cae en el nombre del producto
 * solo si el contexto de empresa todavía no cargó.
 */
export function generateQuotePdf(quote: Quote, companyName: string = PRODUCT_NAME): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;

  // ── Colores ──────────────────────────────────────────────
  const green  = [22, 101, 52]  as [number, number, number]; // green-800
  const gray   = [75, 85, 99]   as [number, number, number]; // gray-600
  const dark   = [17, 24, 39]   as [number, number, number]; // gray-900

  // ── Header ───────────────────────────────────────────────
  doc.setFillColor(...green);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), margin, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Presupuesto comercial', margin, 19);

  // Número de presupuesto (derecha)
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  const numStr = `#${String(quote.quote_number).padStart(4, '0')}`;
  doc.text(numStr, pageW - margin, 17, { align: 'right' });

  // ── Datos del presupuesto ────────────────────────────────
  let y = 38;

  doc.setTextColor(...dark);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', margin, y);
  doc.text('FECHA', pageW / 2, y);
  doc.text('MONEDA', pageW - margin, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.setFontSize(11);
  y += 6;

  const clientName = quote.client?.name ?? '—';
  const dateStr    = formatDate(quote.quote_date, 'long');

  doc.setTextColor(...dark);
  doc.text(clientName, margin, y);
  doc.text(dateStr,    pageW / 2, y);
  doc.text(quote.currency, pageW - margin, y, { align: 'right' });

  // ── Línea separadora ─────────────────────────────────────
  y += 8;
  doc.setDrawColor(...green);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Tabla de ítems ───────────────────────────────────────
  const items = quote.items ?? [];
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Producto / Servicio', 'Cant.', 'Precio unit.', 'Total']],
    body: items.map(item => [
      item.product,
      String(item.quantity),
      `${quote.currency} ${Number(item.unit_price).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
      `${quote.currency} ${Number(item.total_price).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
    ]),
    headStyles: {
      fillColor: green,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles:  { fontSize: 9, textColor: dark },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32 },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    theme: 'grid',
  });

  // ── Total ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 6;

  doc.setFillColor(249, 250, 251);
  doc.rect(pageW - margin - 70, finalY - 4, 70, 12, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text('TOTAL', pageW - margin - 38, finalY + 4);
  doc.setTextColor(...green);
  doc.setFontSize(12);
  const totalStr = `${quote.currency} ${Number(quote.total_amount).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
  doc.text(totalStr, pageW - margin, finalY + 4, { align: 'right' });

  // ── Texto informativo ────────────────────────────────────
  if (quote.information?.information) {
    const infoY = finalY + 18;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin, infoY - 4, pageW - margin, infoY - 4);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...gray);
    doc.text(quote.information.name.toUpperCase(), margin, infoY + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    const lines = doc.splitTextToSize(quote.information.information, pageW - margin * 2);
    doc.text(lines, margin, infoY + 8);
  }

  // ── Footer ───────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(`${companyName} · Documento generado automáticamente`, pageW / 2, pageH - 8, { align: 'center' });

  // ── Guardar ──────────────────────────────────────────────
  doc.save(`presupuesto-${String(quote.quote_number).padStart(4, '0')}-${quote.client?.name ?? 'cliente'}.pdf`);
}
