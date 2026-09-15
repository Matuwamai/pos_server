const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Used when interpolating user-supplied strings (names, notes, addresses)
// into server-rendered HTML documents (receipts/invoices) — those values
// are never attacker-controlled in the usual sense, but escaping keeps a
// stray "<" in a customer name or invoice note from being interpreted as
// markup if the document is later opened in a browser context.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}

export default escapeHtml;
