import prisma from '../config/prismaClient.js';
import orderService from './order.js';
import escapeHtml from '../utils/escapeHtml.js';
import { getCurrencyDecimalDigits } from '../config/currencies.js';

function money(amount, decimalDigits) {
  return Number(amount).toFixed(decimalDigits);
}

// The app's signature teal — used whenever a tenant hasn't picked their own
// themeColor (web_app's src/utils/theme.js defaults to the same hex).
const DEFAULT_ACCENT_COLOR = '#0f766e';

// themeColor is embedded directly into a <style> block below (a CSS context, where
// escapeHtml's entity-escaping wouldn't help) — validations/tenantSelf.js already
// only ever lets a clean 6-digit hex through, but re-checking here means a future
// write path can never turn this into a CSS-injection vector.
function safeAccentColor(themeColor) {
  return /^#[0-9a-fA-F]{6}$/.test(themeColor ?? '') ? themeColor : DEFAULT_ACCENT_COLOR;
}

function formatDateTime(date) {
  return new Date(date).toLocaleString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function itemLine(item, decimalDigits) {
  const name = item.variant.product.name + (item.variant.sku ? ` (${item.variant.sku})` : '');
  const modifiersLine = item.modifiers.length
    ? `<div class="modifiers">${item.modifiers.map((m) => `+ ${escapeHtml(m.modifier.name)}`).join(', ')}</div>`
    : '';
  return `
    <tr>
      <td>${escapeHtml(name)}${modifiersLine}</td>
      <td class="num">${Number(item.quantity)}</td>
      <td class="num">${money(item.unitPrice, decimalDigits)}</td>
      <td class="num">${money(item.lineTotal, decimalDigits)}</td>
    </tr>`;
}

async function generateReceiptHtml(orderId) {
  const order = await orderService.getOrderById(orderId);
  const tenant = await prisma.tenant.findUnique({ where: { id: order.tenantId } });
  const decimalDigits = getCurrencyDecimalDigits(order.currency);
  const accentColor = safeAccentColor(tenant.themeColor);
  const footerMessage = tenant.receiptFooterMessage || 'Thank you for your business!';

  const itemRows = order.items.map((item) => itemLine(item, decimalDigits)).join('');
  const paymentRows = order.payments
    .map((p) => `<tr><td>${escapeHtml(p.method)}</td><td class="num">${money(p.amount, decimalDigits)}</td></tr>`)
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt #${order.orderNumber}</title>
<style>
  body { font-family: 'Courier New', monospace; color: #1a1a1a; max-width: 320px; margin: 0 auto; padding: 16px; font-size: 13px; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 4px; color: ${accentColor}; }
  .logo { display: block; max-width: 120px; max-height: 80px; margin: 0 auto 6px; }
  .center { text-align: center; }
  .muted { color: #555; }
  hr { border: none; border-top: 1px dashed #999; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 2px 0; text-align: left; }
  .num { text-align: right; }
  .modifiers { font-size: 11px; color: #666; padding-left: 8px; }
  .totals td { padding: 2px 0; }
  .grand td { font-weight: bold; font-size: 15px; border-top: 2px solid ${accentColor}; padding-top: 4px; }
  .footer { margin-top: 16px; text-align: center; font-size: 11px; color: #777; }
</style>
</head>
<body>
  ${tenant.receiptShowLogo && tenant.logoUrl ? `<img class="logo" src="${escapeHtml(tenant.logoUrl)}" alt="${escapeHtml(tenant.name)}">` : ''}
  <h1>${escapeHtml(tenant.name)}</h1>
  <div class="center muted">${escapeHtml(order.location.name)}</div>
  <div class="center muted">${formatDateTime(order.createdAt)}</div>
  <hr>
  <div>Receipt #${order.orderNumber} &middot; ${escapeHtml(order.currency)}</div>
  ${tenant.receiptShowCashierName ? `<div class="muted">Served by ${escapeHtml(order.user.name)}</div>` : ''}
  ${order.customer && tenant.receiptShowCustomerName ? `<div class="muted">Customer: ${escapeHtml(order.customer.name)}</div>` : ''}
  <hr>
  <table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr>
  <table class="totals">
    <tr><td>Subtotal</td><td class="num">${money(order.subtotal, decimalDigits)}</td></tr>
    <tr><td>Discount</td><td class="num">-${money(order.discountTotal, decimalDigits)}</td></tr>
    <tr><td>Tax</td><td class="num">${money(order.taxTotal, decimalDigits)}</td></tr>
    ${(() => {
      const adjustment = Number(order.cashRoundingAdjustment);
      if (adjustment === 0) return '';
      return `<tr><td>Rounding</td><td class="num">${adjustment > 0 ? '' : '-'}${money(Math.abs(adjustment), decimalDigits)}</td></tr>`;
    })()}
    <tr class="grand"><td>Total</td><td class="num">${money(order.total, decimalDigits)}</td></tr>
  </table>
  <hr>
  <table>
    <thead><tr><th>Payment</th><th class="num">Amount</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>
  <div class="footer">${escapeHtml(footerMessage)}</div>
</body>
</html>`;
}

export default { generateReceiptHtml };
