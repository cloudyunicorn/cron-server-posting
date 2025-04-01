-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);
