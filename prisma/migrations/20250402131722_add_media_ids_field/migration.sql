-- AlterTable
ALTER TABLE "ScheduledPost" ADD COLUMN     "mediaIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
