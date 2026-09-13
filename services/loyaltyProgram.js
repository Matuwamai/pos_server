import prisma from '../config/prismaClient.js';
import ApiError from '../utils/ApiError.js';

// One per tenant (tenantId is @unique on the model) — not auto-provisioned
// at signup like Subscription is, since a loyalty program is an opt-in
// business decision, not something required for the app to function.

async function createLoyaltyProgram({ pointsPerCurrencyUnit, redemptionRate }) {
  const existing = await prisma.loyaltyProgram.findFirst();
  if (existing) {
    throw ApiError.conflict('A loyalty program is already configured for this tenant');
  }
  return prisma.loyaltyProgram.create({ data: { pointsPerCurrencyUnit, redemptionRate } });
}

async function getLoyaltyProgram() {
  const program = await prisma.loyaltyProgram.findFirst();
  if (!program) throw ApiError.notFound('No loyalty program has been configured yet');
  return program;
}

async function updateLoyaltyProgram(updates) {
  const program = await getLoyaltyProgram();
  return prisma.loyaltyProgram.update({ where: { id: program.id }, data: updates });
}

export default { createLoyaltyProgram, getLoyaltyProgram, updateLoyaltyProgram };
