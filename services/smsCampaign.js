import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../utils/queryHelpers.js';
import smsTemplateService from './smsTemplate.js';

// Creates a DRAFT campaign only — this codebase has no background
// job/scheduler infrastructure, so there is nothing yet that walks
// `filters`/`selectedRecipients` and actually sends the messages. That
// execution step is intentionally left for when a job runner exists.
async function createCampaign(actingUser, { name, templateId, recipientMode, filters, selectedRecipients, scheduledFor }) {
  await smsTemplateService.getSmsTemplateById(templateId); // 404s if missing/foreign tenant

  return prisma.smsCampaign.create({
    data: {
      name,
      templateId,
      recipientMode,
      filters,
      selectedRecipients,
      scheduledFor,
      createdById: actingUser.id,
      status: scheduledFor ? 'SCHEDULED' : 'DRAFT',
    },
  });
}

async function listCampaigns({ status, page, limit }) {
  const where = { ...(status ? { status } : {}) };

  const [total, campaigns] = await prisma.$transaction([
    prisma.smsCampaign.count({ where }),
    prisma.smsCampaign.findMany({ where, orderBy: { createdAt: 'desc' }, ...getPagination({ page, limit }) }),
  ]);

  return { data: campaigns, pagination: buildPaginationMeta({ page, limit, total }) };
}

async function getCampaignById(id) {
  const campaign = await prisma.smsCampaign.findUnique({ where: { id } });
  if (!campaign) throw ApiError.notFound('SMS campaign not found');
  return campaign;
}

function assertEditable(campaign) {
  if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
    throw ApiError.conflict('Only a draft or scheduled campaign can be edited');
  }
}

async function updateCampaign(id, updates) {
  const campaign = await getCampaignById(id);
  assertEditable(campaign);

  if (updates.templateId) {
    await smsTemplateService.getSmsTemplateById(updates.templateId); // 404s if missing/foreign tenant
  }

  const data = { ...updates };
  if ('scheduledFor' in updates) {
    data.status = updates.scheduledFor ? 'SCHEDULED' : 'DRAFT';
  }

  return prisma.smsCampaign.update({ where: { id }, data });
}

async function cancelCampaign(id) {
  const campaign = await getCampaignById(id);
  if (['COMPLETED', 'CANCELLED'].includes(campaign.status)) {
    throw ApiError.conflict(`Campaign is already ${campaign.status.toLowerCase()}`);
  }
  return prisma.smsCampaign.update({ where: { id }, data: { status: 'CANCELLED' } });
}

export default { createCampaign, listCampaigns, getCampaignById, updateCampaign, cancelCampaign };
