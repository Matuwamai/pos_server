import prisma from '../config/prismaClient.js';
import orderService from './order.js';
import escapeHtml from '../utils/escapeHtml.js';

function money(amount) {
  return Number(amount).toFixed(2);
}

function formatDateTime(date) {
  return new Date(date).toLocaleString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function itemLine(item) {
  const name = item.variant.product.name + (item.variant.sku ? ` (${item.variant.sku})` : '');
  const modifiersLine = item.modifiers.length
    ? `<div class="modifiers">${item.modifiers.map((m) => `+ ${escapeHtml(m.modifier.name)}`).join(', ')}</div>`
    : '';
  return `
    <tr>
      <td>${escapeHtml(name)}${modifiersLine}</td>
      <td class="num">${Number(item.quantity)}</td>
      <td class="num">${money(item.unitPrice)}</td>
      <td class="num">${money(item.lineTotal)}</td>
    </tr>`;
}

// A simple, print-friendly (80mm thermal-style) receipt rendered straight
// from the Order data that already exists — no separate Receipt model,
// since a receipt is just a formatted view of a completed sale.
async function generateReceiptHtml(orderId) {
  const order = await orderService.getOrderById(orderId);
  const tenant = await prisma.tenant.findUnique({ where: { id: order.tenantId } });

  const itemRows = order.items.map(itemLine).join('');
  const paymentRows = order.payments
    .map((p) => `<tr><td>${escapeHtml(p.method)}</td><td class="num">${money(p.amount)}</td></tr>`)
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt #${order.orderNumber}</title>
<style>
  body { font-family: 'Courier New', monospace; color: #1a1a1a; max-width: 320px; margin: 0 auto; padding: 16px; font-size: 13px; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
  .center { text-align: center; }
  .muted { color: #555; }
  hr { border: none; border-top: 1px dashed #999; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 2px 0; text-align: left; }
  .num { text-align: right; }
  .modifiers { font-size: 11px; color: #666; padding-left: 8px; }
  .totals td { padding: 2px 0; }
  .grand td { font-weight: bold; font-size: 15px; }
  .footer { margin-top: 16px; text-align: center; font-size: 11px; color: #777; }
</style>
</head>
<body>
  <h1>${escapeHtml(tenant.name)}</h1>
  <div class="center muted">${escapeHtml(order.location.name)}</div>
  <div class="center muted">${formatDateTime(order.createdAt)}</div>
  <hr>
  <div>Receipt #${order.orderNumber}</div>
  <div class="muted">Served by ${escapeHtml(order.user.name)}</div>
  ${order.customer ? `<div class="muted">Customer: ${escapeHtml(order.customer.name)}</div>` : ''}
  <hr>
  <table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr>
  <table class="totals">
    <tr><td>Subtotal</td><td class="num">${money(order.subtotal)}</td></tr>
    <tr><td>Discount</td><td class="num">-${money(order.discountTotal)}</td></tr>
    <tr><td>Tax</td><td class="num">${money(order.taxTotal)}</td></tr>
    <tr class="grand"><td>Total</td><td class="num">${money(order.total)}</td></tr>
  </table>
  <hr>
  <table>
    <thead><tr><th>Payment</th><th class="num">Amount</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>
  <div class="footer">Thank you for your business!</div>
</body>
</html>`;
}

export default { generateReceiptHtml };
