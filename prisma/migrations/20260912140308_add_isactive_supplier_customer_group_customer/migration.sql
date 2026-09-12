-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `CustomerGroup` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Supplier` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
