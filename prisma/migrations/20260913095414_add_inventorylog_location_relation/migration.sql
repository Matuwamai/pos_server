-- CreateIndex
CREATE INDEX `InventoryLog_locationId_idx` ON `InventoryLog`(`locationId`);

-- AddForeignKey
ALTER TABLE `InventoryLog` ADD CONSTRAINT `InventoryLog_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
