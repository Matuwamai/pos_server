-- AlterTable
ALTER TABLE `User` ADD COLUMN `mfaEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `phone` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `SmsTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `eventType` ENUM('ORDER_CREATED', 'ORDER_DISPATCHED', 'PAYMENT_RECEIVED', 'ACCOUNT_RECONCILIATION', 'MARKETING', 'OTP', 'DIRECT_MESSAGE', 'ACCOUNT_CREATION', 'OTP_RESEND') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SmsTemplate_tenantId_idx`(`tenantId`),
    INDEX `SmsTemplate_eventType_isActive_idx`(`eventType`, `isActive`),
    UNIQUE INDEX `SmsTemplate_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SmsMessage` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `campaignId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `recipientPhone` VARCHAR(191) NOT NULL,
    `recipientName` VARCHAR(191) NULL,
    `recipientType` VARCHAR(191) NOT NULL,
    `messageContent` TEXT NOT NULL,
    `status` ENUM('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'REJECTED', 'PERMANENTLY_FAILED') NOT NULL DEFAULT 'PENDING',
    `africastalkingMessageId` VARCHAR(191) NULL,
    `cost` DOUBLE NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `lastRetryAt` DATETIME(3) NULL,
    `scheduledFor` DATETIME(3) NULL,
    `eventType` ENUM('ORDER_CREATED', 'ORDER_DISPATCHED', 'PAYMENT_RECEIVED', 'ACCOUNT_RECONCILIATION', 'MARKETING', 'OTP', 'DIRECT_MESSAGE', 'ACCOUNT_CREATION', 'OTP_RESEND') NULL,
    `referenceId` VARCHAR(191) NULL,
    `referenceType` VARCHAR(191) NULL,
    `failureReason` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SmsMessage_tenantId_idx`(`tenantId`),
    INDEX `SmsMessage_recipientPhone_status_idx`(`recipientPhone`, `status`),
    INDEX `SmsMessage_status_scheduledFor_idx`(`status`, `scheduledFor`),
    INDEX `SmsMessage_campaignId_status_idx`(`campaignId`, `status`),
    INDEX `SmsMessage_templateId_idx`(`templateId`),
    INDEX `SmsMessage_userId_idx`(`userId`),
    INDEX `SmsMessage_eventType_status_idx`(`eventType`, `status`),
    INDEX `SmsMessage_referenceId_referenceType_idx`(`referenceId`, `referenceType`),
    INDEX `SmsMessage_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SmsCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `recipientMode` VARCHAR(191) NOT NULL DEFAULT 'FILTER',
    `filters` JSON NOT NULL,
    `selectedRecipients` JSON NULL,
    `scheduledFor` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `recipientCount` INTEGER NOT NULL DEFAULT 0,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `deliveredCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `totalCost` DOUBLE NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SmsCampaign_tenantId_idx`(`tenantId`),
    INDEX `SmsCampaign_status_scheduledFor_idx`(`status`, `scheduledFor`),
    INDEX `SmsCampaign_templateId_idx`(`templateId`),
    INDEX `SmsCampaign_createdById_idx`(`createdById`),
    INDEX `SmsCampaign_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SmsOtp` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `isUsed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SmsOtp_userId_isUsed_idx`(`userId`, `isUsed`),
    INDEX `SmsOtp_phone_code_expiresAt_idx`(`phone`, `code`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SmsTemplate` ADD CONSTRAINT `SmsTemplate_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsMessage` ADD CONSTRAINT `SmsMessage_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsMessage` ADD CONSTRAINT `SmsMessage_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `SmsTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsMessage` ADD CONSTRAINT `SmsMessage_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `SmsCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsMessage` ADD CONSTRAINT `SmsMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsCampaign` ADD CONSTRAINT `SmsCampaign_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsCampaign` ADD CONSTRAINT `SmsCampaign_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `SmsTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsCampaign` ADD CONSTRAINT `SmsCampaign_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsOtp` ADD CONSTRAINT `SmsOtp_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
