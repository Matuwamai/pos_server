import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, buildPaginationMeta, searchFilter } from '../utils/queryHelpers.js';

async function createSmsTemplate({ name, code, content, eventType }) {
  const existing = await prisma.smsTemplate.findFirst({ where: { code } });
  if (existing) throw ApiError.conflict('A template with this code already exists');

  return prisma.smsTemplate.create({ data: { name, code, content, eventType } });
}

async function listSmsTemplates({ search, eventType, isActive, page, limit }) {
  const where = {
    ...(eventType ? { eventType } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...searchFilter(search, ['name', 'code']),
  };

  const [total, templates] = await prisma.$transaction([
    prisma.smsTemplate.count({ where }),
    prisma.smsTemplate.findMany({ where, orderBy: { name: 'asc' }, ...getPagination({ page, limit }) }),
  ]);

  return { data: templates, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getSmsTemplateById(id) {
  const template = await prisma.smsTemplate.findUnique({ where: { id } });
  if (!template) throw ApiError.notFound('SMS template not found');
  return template;
}

async function updateSmsTemplate(id, updates) {
  await getSmsTemplateById(id); // ensures it exists (and belongs to this tenant), 404s otherwise

  if (updates.code) {
    const existing = await prisma.smsTemplate.findFirst({ where: { code: updates.code, NOT: { id } } });
    if (existing) throw ApiError.conflict('A template with this code already exists');
  }

  return prisma.smsTemplate.update({ where: { id }, data: updates });
}

async function deactivateSmsTemplate(id) {
  const template = await getSmsTemplateById(id);
  if (!template.isActive) throw ApiError.conflict('Template is already inactive');
  return prisma.smsTemplate.update({ where: { id }, data: { isActive: false } });
}

async function reactivateSmsTemplate(id) {
  const template = await getSmsTemplateById(id);
  if (template.isActive) throw ApiError.conflict('Template is already active');
  return prisma.smsTemplate.update({ where: { id }, data: { isActive: true } });
}

export default {
  createSmsTemplate,
  listSmsTemplates,
  getSmsTemplateById,
  updateSmsTemplate,
  deactivateSmsTemplate,
  reactivateSmsTemplate,
};
