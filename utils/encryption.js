import crypto from 'node:crypto';
import env from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';

// Only read/validated when something actually needs it (not at import
// time) — most tenants never configure M-Pesa STK push, so a missing key
// shouldn't crash the whole app on boot.
function getKey() {
  const raw = env.dataEncryptionKey;
  if (!raw) throw new Error('DATA_ENCRYPTION_KEY is not set — required to store encrypted tenant credentials');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded)');
  return key;
}

// Packed as "iv.authTag.ciphertext", each base64 — a single string column
// is simpler to store than three.
function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString('base64')).join('.');
}

function decrypt(packed) {
  const [ivB64, authTagB64, ciphertextB64] = String(packed).split('.');
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error('Malformed encrypted value');

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}

export default { encrypt, decrypt };
