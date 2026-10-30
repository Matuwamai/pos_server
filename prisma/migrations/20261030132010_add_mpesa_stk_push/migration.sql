-- CreateTable
CREATE TABLE `MpesaCredential` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `environment` ENUM('SANDBOX', 'PRODUCTION') NOT NULL DEFAULT 'SANDBOX',
    `consumerKeyCipher` VARCHAR(191) NOT NULL,
    `consumerSecretCipher` VARCHAR(191) NOT NULL,
    `passkeyCipher` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MpesaCredential_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MpesaPaymentIntent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `terminalId` VARCHAR(191) NULL,
    `locationId` VARCHAR(191) NULL,
    `initiatedByUserId` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `phoneNumber` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT') NOT NULL DEFAULT 'PENDING',
    `checkoutRequestId` VARCHAR(191) NULL,
    `merchantRequestId` VARCHAR(191) NULL,
    `resultCode` INTEGER NULL,
    `resultDesc` VARCHAR(191) NULL,
    `mpesaReceiptNumber` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MpesaPaymentIntent_checkoutRequestId_key`(`checkoutRequestId`),
    INDEX `MpesaPaymentIntent_tenantId_idx`(`tenantId`),
    INDEX `MpesaPaymentIntent_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MpesaCredential` ADD CONSTRAINT `MpesaCredential_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MpesaPaymentIntent` ADD CONSTRAINT `MpesaPaymentIntent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
