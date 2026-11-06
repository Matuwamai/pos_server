-- AlterTable
ALTER TABLE `InvoicePayment` MODIFY `method` ENUM('CASH', 'CARD', 'MPESA', 'STRIPE', 'GIFT_CARD', 'STORE_CREDIT', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `Payment` MODIFY `method` ENUM('CASH', 'CARD', 'MPESA', 'STRIPE', 'GIFT_CARD', 'STORE_CREDIT', 'OTHER') NOT NULL;

-- CreateTable
CREATE TABLE `StripeCredential` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `secretKeyCipher` VARCHAR(191) NOT NULL,
    `webhookSigningSecretCipher` VARCHAR(191) NOT NULL,
    `webhookEndpointId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StripeCredential_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StripePaymentIntent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `terminalId` VARCHAR(191) NULL,
    `locationId` VARCHAR(191) NULL,
    `initiatedByUserId` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT') NOT NULL DEFAULT 'PENDING',
    `checkoutSessionId` VARCHAR(191) NULL,
    `checkoutUrl` VARCHAR(191) NULL,
    `consumedByOrderId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastPolledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StripePaymentIntent_checkoutSessionId_key`(`checkoutSessionId`),
    UNIQUE INDEX `StripePaymentIntent_consumedByOrderId_key`(`consumedByOrderId`),
    INDEX `StripePaymentIntent_tenantId_idx`(`tenantId`),
    INDEX `StripePaymentIntent_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StripeCredential` ADD CONSTRAINT `StripeCredential_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StripePaymentIntent` ADD CONSTRAINT `StripePaymentIntent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
