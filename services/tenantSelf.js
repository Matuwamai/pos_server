import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import mpesaCredentialService from './mpesaCredential.js';
import stripeCredentialService from './stripeCredential.js';
import { getEffectiveCashRoundingUnit } from '../config/cashRounding.js';


const UPLOADS_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

const MIME_EXTENSIONS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

function logoDir(tenantId) {
  return path.join(UPLOADS_ROOT, 'tenants', tenantId);
}

const SELF_FIELDS = {
  id: true,
  name: true,
  subdomain: true,
  currency: true,
  logoUrl: true,
  mpesaType: true,
  mpesaShortcode: true,
  mpesaCredential: { select: { environment: true } },
  stripeCredential: { select: { id: true } },
  cashRoundingUnit: true,
};

// Never exposes the credential itself — only whether one exists and which
// environment it targets, so the settings page can show a "configured"
// state without the secrets ever round-tripping back to a client.
function present(tenant) {
  const { mpesaCredential, stripeCredential, cashRoundingUnit, ...rest } = tenant;
  const cashRoundingUnitOverride = cashRoundingUnit === null ? null : Number(cashRoundingUnit);
  return {
    ...rest,
    mpesaStkConfigured: Boolean(mpesaCredential),
    mpesaStkEnvironment: mpesaCredential?.environment ?? null,
    stripeConfigured: Boolean(stripeCredential),
    // cashRoundingUnitOverride is null when the tenant hasn't set one — clients that
    // need the actual unit in effect (not just the raw override) should use
    // effectiveCashRoundingUnit instead of re-deriving the "null means use the
    // currency default" logic themselves.
    cashRoundingUnitOverride,
    effectiveCashRoundingUnit: getEffectiveCashRoundingUnit(rest.currency, cashRoundingUnitOverride),
  };
}

async function getMyTenant(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: SELF_FIELDS });
  if (!tenant) throw ApiError.notFound('Tenant not found');
  return present(tenant);
}

// Removes any previously-saved logo file for this tenant regardless of its
// extension, so switching from a .png upload to a .jpg one doesn't leave the
// old file behind.
async function clearExistingLogoFiles(tenantId) {
  const dir = logoDir(tenantId);
  const entries = await fs.readdir(dir).catch(() => []);
  await Promise.all(
    entries.filter((name) => name.startsWith('logo.')).map((name) => fs.unlink(path.join(dir, name)))
  );
}

async function updateTenantLogo(tenantId, file) {
  const ext = MIME_EXTENSIONS[file.mimetype];
  if (!ext) throw ApiError.badRequest('Only PNG, JPEG, or WEBP images are accepted');

  const dir = logoDir(tenantId);
  await fs.mkdir(dir, { recursive: true });
  await clearExistingLogoFiles(tenantId);
  await fs.writeFile(path.join(dir, `logo${ext}`), file.buffer);

  const logoUrl = `/uploads/tenants/${tenantId}/logo${ext}`;
  return present(await prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl }, select: SELF_FIELDS }));
}

async function removeTenantLogo(tenantId) {
  await clearExistingLogoFiles(tenantId);
  return present(await prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl: null }, select: SELF_FIELDS }));
}

// Till (Buy Goods) or Paybill number, shown at the point of sale so the
// cashier can tell the customer where to send payment, confirmed manually
// by typing the M-Pesa SMS code in as the payment's transactionRef. This
// is independent of whether STK push (below) is also configured — manual
// entry always works as the fallback.
async function updateTenantPayments(tenantId, { mpesaType, mpesaShortcode }) {
  // M-Pesa only operates in KES — reject configuring a shortcode for any
  // other tenant currency rather than letting it sit there unusable
  // (createPaymentWithSideEffects/mpesaPaymentIntent.createIntent both
  // reject the actual payment anyway, so this just avoids dead config).
  if (mpesaShortcode) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
    if (tenant.currency !== 'KES') {
      throw ApiError.badRequest('M-Pesa is only available for businesses whose currency is KES');
    }
  }
  return present(await prisma.tenant.update({ where: { id: tenantId }, data: { mpesaType, mpesaShortcode }, select: SELF_FIELDS }));
}

// STK push: each tenant's own Daraja app credentials, tied to the till/
// paybill already set via updateTenantPayments. Secrets are encrypted at
// rest (services/mpesaCredential.js) and never returned — present() only
// ever exposes mpesaStkConfigured/mpesaStkEnvironment.
async function updateMpesaCredential(tenantId, { consumerKey, consumerSecret, passkey, environment }) {
  await mpesaCredentialService.upsertCredential(tenantId, { consumerKey, consumerSecret, passkey, environment });
  return getMyTenant(tenantId);
}

async function removeMpesaCredential(tenantId) {
  await mpesaCredentialService.removeCredential(tenantId);
  return getMyTenant(tenantId);
}

// Stripe, unlike M-Pesa, has no currency restriction — it's offered to every tenant
// with a key configured, regardless of tenant.currency (see config/stripeAmount.js for
// how amounts get encoded correctly across currencies).
async function updateStripeCredential(tenantId, { secretKey }) {
  await stripeCredentialService.upsertCredential(tenantId, secretKey);
  return getMyTenant(tenantId);
}

async function removeStripeCredential(tenantId) {
  await stripeCredentialService.removeCredential(tenantId);
  return getMyTenant(tenantId);
}

// cashRoundingUnit: null clears the override back to the currency's own default (see
// config/cashRounding.js); 0 explicitly disables cash rounding regardless of the
// currency default; any other value overrides it.
async function updateCashRounding(tenantId, { cashRoundingUnit }) {
  return present(await prisma.tenant.update({ where: { id: tenantId }, data: { cashRoundingUnit }, select: SELF_FIELDS }));
}

export default {
  getMyTenant,
  updateTenantLogo,
  removeTenantLogo,
  updateTenantPayments,
  updateMpesaCredential,
  removeMpesaCredential,
  updateStripeCredential,
  removeStripeCredential,
  updateCashRounding,
};
