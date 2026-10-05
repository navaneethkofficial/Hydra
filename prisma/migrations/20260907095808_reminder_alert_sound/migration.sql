-- AlterTable
ALTER TABLE "reminder_settings" ADD COLUMN     "soundBeeps" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "soundEnabled" BOOLEAN NOT NULL DEFAULT true;
