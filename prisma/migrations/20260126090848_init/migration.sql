/*
  Warnings:

  - You are about to drop the column `dataMappingId` on the `news_cards` table. All the data in the column will be lost.
  - You are about to drop the `data_mappings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `news_sources` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AutopilotStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "data_mappings" DROP CONSTRAINT "data_mappings_newsSourceId_fkey";

-- DropForeignKey
ALTER TABLE "data_mappings" DROP CONSTRAINT "data_mappings_templateId_fkey";

-- DropForeignKey
ALTER TABLE "data_mappings" DROP CONSTRAINT "data_mappings_userId_fkey";

-- DropForeignKey
ALTER TABLE "news_cards" DROP CONSTRAINT "news_cards_dataMappingId_fkey";

-- DropForeignKey
ALTER TABLE "news_sources" DROP CONSTRAINT "news_sources_userId_fkey";

-- AlterTable
ALTER TABLE "news_cards" DROP COLUMN "dataMappingId";

-- DropTable
DROP TABLE "data_mappings";

-- DropTable
DROP TABLE "news_sources";

-- DropEnum
DROP TYPE "SourceType";

-- CreateTable
CREATE TABLE "fonts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fonts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autopilot_settings" (
    "id" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "checkInterval" INTEGER NOT NULL DEFAULT 15,
    "generateCards" BOOLEAN NOT NULL DEFAULT true,
    "sensitiveFilter" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnNewCard" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autopilot_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autopilot_runs" (
    "id" TEXT NOT NULL,
    "status" "AutopilotStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "newsFound" INTEGER NOT NULL DEFAULT 0,
    "cardsCreated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "autopilot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_words" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensitive_words_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fonts_family_key" ON "fonts"("family");

-- CreateIndex
CREATE INDEX "fonts_userId_idx" ON "fonts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "autopilot_settings_userId_key" ON "autopilot_settings"("userId");

-- CreateIndex
CREATE INDEX "autopilot_settings_isEnabled_idx" ON "autopilot_settings"("isEnabled");

-- CreateIndex
CREATE INDEX "autopilot_runs_userId_idx" ON "autopilot_runs"("userId");

-- CreateIndex
CREATE INDEX "autopilot_runs_startedAt_idx" ON "autopilot_runs"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sensitive_words_word_key" ON "sensitive_words"("word");

-- CreateIndex
CREATE INDEX "sensitive_words_userId_idx" ON "sensitive_words"("userId");

-- CreateIndex
CREATE INDEX "sensitive_words_isActive_idx" ON "sensitive_words"("isActive");
