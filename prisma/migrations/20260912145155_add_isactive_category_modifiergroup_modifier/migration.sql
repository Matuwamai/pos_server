-- AlterTable
ALTER TABLE `Category` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Modifier` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `ModifierGroup` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
