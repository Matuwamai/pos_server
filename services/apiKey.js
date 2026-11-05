import crypto from 'crypto';
import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';

const KEY_PREFIX_LENGTH = 12;

function generateRawKey() {
  return `pk_${crypto.randomBytes(24).toString('hex')}`;
}

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

const apiKeyInclude = {
  createdBy: { select: { id: true, name: true } },
  permissions: { include: { permission: { select: { id: true, code: true, category: true } } } },
};

function serialize(apiKey) {
  if (!apiKey) return apiKey;
  const { permissions, keyHash, ...rest } = apiKey; // eslint-disable-line no-unused-vars
  return { ...rest, permissions: permissions.map((p) => p.permission) };
}

async function createApiKey(actingUser, callerPermissions, { name, permissionCodes, expiresAt }) {
  const codes = permissionCodes || [];
  const permissions = await prisma.permission.findMany({ where: { code: { in: codes } } });
  if (codes.length !== permissions.length) {
    throw ApiError.badRequest('One or more permission codes are invalid');
  }
  const notHeldByCaller = codes.filter((code) => !callerPermissions.has(code));
  if (notHeldByCaller.length > 0) {
    throw ApiError.forbidden(`You cannot grant permissions you don't have: ${notHeldByCaller.join(', ')}`);
  }

  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, KEY_PREFIX_LENGTH);

  const apiKeyId = await prisma.$transaction(async (tx) => {
    const apiKey = await tx.apiKey.create({
      data: { name, keyHash, keyPrefix, expiresAt, createdById: actingUser.id },
    });
    if (permissions.length > 0) {
      await tx.apiKeyPermission.createMany({ data: permissions.map((p) => ({ apiKeyId: apiKey.id, permissionId: p.id })) });
    }
    return apiKey.id;
  });

  const created = await getApiKeyById(apiKeyId);
  return { ...created, key: rawKey };
}

async function listApiKeys() {
  const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' }, include: apiKeyInclude });
  return keys.map(serialize);
}

async function getApiKeyById(id) {
  const apiKey = await prisma.apiKey.findUnique({ where: { id }, include: apiKeyInclude });
  if (!apiKey) throw ApiError.notFound('API key not found');
  return serialize(apiKey);
}

async function revokeApiKey(id) {
  const apiKey = await prisma.apiKey.findUnique({ where: { id } });
  if (!apiKey) throw ApiError.notFound('API key not found');
  if (!apiKey.isActive) throw ApiError.conflict('API key is already revoked');
  return prisma.apiKey.update({ where: { id }, data: { isActive: false } });
}

async function findByRawKey(rawKey) {
  const keyHash = hashKey(rawKey);
  return prisma.apiKey.findUnique({
    where: { keyHash },
    include: { permissions: { select: { permission: { select: { code: true } } } } },
  });
}

export default { createApiKey, listApiKeys, getApiKeyById, revokeApiKey, findByRawKey };
