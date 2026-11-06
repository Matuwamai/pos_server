-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `receiptFooterMessage` VARCHAR(200) NULL,
    ADD COLUMN `receiptShowCashierName` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `receiptShowCustomerName` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `receiptShowLogo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `themeColor` VARCHAR(7) NULL;
