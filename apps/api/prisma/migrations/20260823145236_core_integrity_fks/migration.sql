-- DropForeignKey
ALTER TABLE "setting" DROP CONSTRAINT "setting_locationId_fkey";

-- AddForeignKey
ALTER TABLE "setting" ADD CONSTRAINT "setting_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_series" ADD CONSTRAINT "numbering_series_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
