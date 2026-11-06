import prisma from '../config/prismaClient.js';
import invoiceService from './invoice.js';
import escapeHtml from '../utils/escapeHtml.js';
import { getCurrencyDecimalDigits } from '../config/currencies.js';

function money(amount, decimalDigits) {
  return Number(amount).toFixed(decimalDigits);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Mirrors services/receipt.js's safeAccentColor exactly — themeColor is embedded
// directly into a <style> block below, so this re-validates it even though
// validations/tenantSelf.js already only lets a clean 6-digit hex through.
const DEFAULT_ACCENT_COLOR = '#0f766e';
function safeAccentColor(themeColor) {
  return /^#[0-9a-fA-F]{6}$/.test(themeColor ?? '') ? themeColor : DEFAULT_ACCENT_COLOR;
}

async function generateInvoiceHtml(invoiceId) {
  const invoice = await invoiceService.getInvoiceById(invoiceId);
  const tenant = await prisma.tenant.findUnique({ where: { id: invoice.tenantId } });
  const decimalDigits = getCurrencyDecimalDigits(invoice.currency);

  const itemRows = invoice.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.description)}</td>
          <td class="num">${Number(item.quantity)}</td>
          <td class="num">${money(item.unitPrice, decimalDigits)}</td>
          <td class="num">${money(item.taxAmount, decimalDigits)}</td>
          <td class="num">${money(item.lineTotal, decimalDigits)}</td>
        </tr>`
    )
    .join('');

  const paymentRows = invoice.payments
    .map(
      (p) => `<tr><td>${formatDate(p.createdAt)}</td><td>${escapeHtml(p.method)}</td><td class="num">${money(p.amount, decimalDigits)}</td></tr>`
    )
    .join('');

  const balanceDue = money(Number(invoice.total) - Number(invoice.amountPaid), decimalDigits);
  const accentColor = safeAccentColor(tenant.themeColor);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice #${invoice.invoiceNumber}</title>
<style>
  body { font-family: Arial, sans-serif; color: #1a1a1a; max-width: 700px; margin: 0 auto; padding: 32px; }
  h1 { font-size: 22px; margin: 0; color: ${accentColor}; }
  .muted { color: #666; }
  .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .status { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
  .status-DRAFT { background: #eee; color: #555; }
  .status-SENT { background: #dbeafe; color: #1e40af; }
  .status-PARTIALLY_PAID { background: #fef3c7; color: #92400e; }
  .status-PAID { background: #dcfce7; color: #166534; }
  .status-VOID { background: #fee2e2; color: #991b1b; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; font-size: 14px; }
  .num { text-align: right; }
  .totals { width: 100%; max-width: 300px; margin-left: auto; margin-top: 16px; }
  .totals td { border: none; padding: 4px 8px; }
  .totals .grand td { font-weight: bold; font-size: 16px; border-top: 2px solid ${accentColor}; }
  .bill-to { margin-top: 24px; }
  .footer { margin-top: 40px; font-size: 12px; color: #888; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(tenant.name)}</h1>
      ${invoice.location ? `<div class="muted">${escapeHtml(invoice.location.name)}${invoice.location.address ? ' — ' + escapeHtml(invoice.location.address) : ''}</div>` : ''}
    </div>
    <div style="text-align:right">
      <h1>INVOICE</h1>
      <div class="muted">#${invoice.invoiceNumber} &middot; ${escapeHtml(invoice.currency)}</div>
      <span class="status status-${invoice.status}">${invoice.status.replace('_', ' ')}</span>
    </div>
  </div>

  <div class="bill-to">
    <strong>Bill to</strong><br>
    ${escapeHtml(invoice.customer.name)}<br>
    ${invoice.customer.email ? `<span class="muted">${escapeHtml(invoice.customer.email)}</span><br>` : ''}
    ${invoice.customer.phone ? `<span class="muted">${escapeHtml(invoice.customer.phone)}</span>` : ''}
  </div>

  <p>
    <strong>Issue date:</strong> ${formatDate(invoice.issueDate)}<br>
    <strong>Due date:</strong> ${formatDate(invoice.dueDate)}
  </p>

  <table>
    <thead>
      <tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Tax</th><th class="num">Line total</th></tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td class="num">${money(invoice.subtotal, decimalDigits)}</td></tr>
    <tr><td>Discount</td><td class="num">-${money(invoice.discountTotal, decimalDigits)}</td></tr>
    <tr><td>Tax</td><td class="num">${money(invoice.taxTotal, decimalDigits)}</td></tr>
    <tr class="grand"><td>Total</td><td class="num">${money(invoice.total, decimalDigits)}</td></tr>
    <tr><td>Amount paid</td><td class="num">${money(invoice.amountPaid, decimalDigits)}</td></tr>
    <tr class="grand"><td>Balance due</td><td class="num">${balanceDue}</td></tr>
  </table>

  ${
    invoice.payments.length > 0
      ? `<h3>Payment history</h3>
  <table>
    <thead><tr><th>Date</th><th>Method</th><th class="num">Amount</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>`
      : ''
  }

  ${invoice.notes ? `<p><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</p>` : ''}

  <div class="footer">Generated by ${escapeHtml(tenant.name)} — Invoice #${invoice.invoiceNumber}</div>
  ${tenant.receiptFooterMessage ? `<div class="footer">${escapeHtml(tenant.receiptFooterMessage)}</div>` : ''}
</body>
</html>`;
}

export default { generateInvoiceHtml };
