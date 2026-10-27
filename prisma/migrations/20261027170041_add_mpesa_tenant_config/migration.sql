-- AlterTable
ALTER TABLE `InvoicePayment` MODIFY `method` ENUM('CASH', 'CARD', 'MPESA', 'GIFT_CARD', 'STORE_CREDIT', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `Payment` MODIFY `method` ENUM('CASH', 'CARD', 'MPESA', 'GIFT_CARD', 'STORE_CREDIT', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `mpesaShortcode` VARCHAR(191) NULL,
    ADD COLUMN `mpesaType` ENUM('TILL', 'PAYBILL') NULL;
