-- AlterTable
ALTER TABLE "reminder_settings" ADD COLUMN     "soundTone" TEXT NOT NULL DEFAULT 'classic',
ADD COLUMN     "vibrationEnabled" BOOLEAN NOT NULL DEFAULT true;
