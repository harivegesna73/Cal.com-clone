/*
  Warnings:

  - You are about to drop the column `scheduleId` on the `Availability` table. All the data in the column will be lost.
  - You are about to drop the `AvailabilitySchedule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_scheduleId_fkey";

-- DropForeignKey
ALTER TABLE "AvailabilitySchedule" DROP CONSTRAINT "AvailabilitySchedule_userId_fkey";

-- AlterTable
ALTER TABLE "Availability" DROP COLUMN "scheduleId";

-- DropTable
DROP TABLE "AvailabilitySchedule";
