import prisma from '../config/prismaClient.js';
import { runWithTenant } from '../config/tenantContext.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiKeyService from '../services/apiKey.js';

const authenticateApiKey = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('ApiKey ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header (expected "ApiKey <key>")');
  }
  const rawKey = header.split(' ')[1];

  const apiKey = await apiKeyService.findByRawKey(rawKey);
  if (!apiKey || !apiKey.isActive) {
    throw ApiError.unauthorized('Invalid or revoked API key');
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw ApiError.unauthorized('This API key has expired');
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: apiKey.tenantId }, select: { status: true } });
  if (!tenant || tenant.status !== 'ACTIVE') {
    throw ApiError.forbidden('This tenant account is not active');
  }

  req.tenantId = apiKey.tenantId;
  req.apiKey = { id: apiKey.id, name: apiKey.name };
  req.permissions = new Set(apiKey.permissions.map((p) => p.permission.code));

  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  runWithTenant(apiKey.tenantId, next);
});

export default authenticateApiKey;
