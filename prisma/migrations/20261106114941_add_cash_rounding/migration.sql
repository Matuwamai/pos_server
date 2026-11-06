-- AlterTable
ALTER TABLE `Order` ADD COLUMN `cashRoundingAdjustment` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `cashRoundingUnit` DECIMAL(10, 2) NULL;
