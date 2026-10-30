import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import encryption from '../utils/encryption.js';

// Per-tenant Daraja app credentials — never returned to a client once
// saved (see services/tenantSelf.js, which only ever exposes whether a
// credential exists and which environment it's for).
async function upsertCredential(tenantId, { consumerKey, consumerSecret, passkey, environment }) {
  const data = {
    environment,
    consumerKeyCipher: encryption.encrypt(consumerKey),
    consumerSecretCipher: encryption.encrypt(consumerSecret),
    passkeyCipher: encryption.encrypt(passkey),
  };
  await prisma.mpesaCredential.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}

async function removeCredential(tenantId) {
  await prisma.mpesaCredential.deleteMany({ where: { tenantId } });
}

// Throws badRequest (not notFound — from the caller's point of view this
// is "STK push isn't configured yet", a normal/expected state) if the
// tenant hasn't set anything up.
async function getDecryptedCredential(tenantId) {
  const row = await prisma.mpesaCredential.findUnique({ where: { tenantId } });
  if (!row) throw ApiError.badRequest("M-Pesa prompts aren't set up for this business yet");
  return {
    environment: row.environment,
    consumerKey: encryption.decrypt(row.consumerKeyCipher),
    consumerSecret: encryption.decrypt(row.consumerSecretCipher),
    passkey: encryption.decrypt(row.passkeyCipher),
  };
}

export default { upsertCredential, removeCredential, getDecryptedCredential };
