-- CreateTable
CREATE TABLE `DailySalesSummary` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `orderCount` INTEGER NOT NULL DEFAULT 0,
    `itemCount` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discountTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `refundTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `netTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DailySalesSummary_tenantId_idx`(`tenantId`),
    INDEX `DailySalesSummary_date_idx`(`date`),
    UNIQUE INDEX `DailySalesSummary_tenantId_locationId_date_key`(`tenantId`, `locationId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DailySalesSummary` ADD CONSTRAINT `DailySalesSummary_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailySalesSummary` ADD CONSTRAINT `DailySalesSummary_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
