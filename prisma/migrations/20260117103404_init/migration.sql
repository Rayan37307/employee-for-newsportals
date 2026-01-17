-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('BREAKING_NEWS', 'ANALYSIS', 'OPINION', 'PHOTO_STORY', 'INFOGRAPHIC', 'QUOTE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('RSS', 'API', 'MANUAL');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('DRAFT', 'GENERATED', 'POSTED', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'TWITTER', 'LINKEDIN', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('QUEUED', 'POSTING', 'POSTED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "TemplateCategory" NOT NULL DEFAULT 'CUSTOM',
    "canvasData" JSONB NOT NULL,
    "thumbnail" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "config" JSONB NOT NULL,
    "updateFrequency" INTEGER NOT NULL DEFAULT 60,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_mappings" (
    "id" TEXT NOT NULL,
    "newsSourceId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sourceFields" JSONB NOT NULL,
    "transformations" JSONB,
    "fallbackValues" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_cards" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" "CardStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceData" JSONB NOT NULL,
    "templateId" TEXT NOT NULL,
    "dataMappingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "status" "PostStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "platformUrl" TEXT,
    "platformPostId" TEXT,
    "metrics" JSONB,
    "newsCardId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "templates_userId_idx" ON "templates"("userId");

-- CreateIndex
CREATE INDEX "templates_category_idx" ON "templates"("category");

-- CreateIndex
CREATE INDEX "news_sources_userId_idx" ON "news_sources"("userId");

-- CreateIndex
CREATE INDEX "news_sources_enabled_idx" ON "news_sources"("enabled");

-- CreateIndex
CREATE INDEX "data_mappings_newsSourceId_idx" ON "data_mappings"("newsSourceId");

-- CreateIndex
CREATE INDEX "data_mappings_templateId_idx" ON "data_mappings"("templateId");

-- CreateIndex
CREATE INDEX "data_mappings_userId_idx" ON "data_mappings"("userId");

-- CreateIndex
CREATE INDEX "news_cards_templateId_idx" ON "news_cards"("templateId");

-- CreateIndex
CREATE INDEX "news_cards_status_idx" ON "news_cards"("status");

-- CreateIndex
CREATE INDEX "news_cards_createdAt_idx" ON "news_cards"("createdAt");

-- CreateIndex
CREATE INDEX "social_accounts_userId_idx" ON "social_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_platform_pageId_key" ON "social_accounts"("platform", "pageId");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "posts_scheduledFor_idx" ON "posts"("scheduledFor");

-- CreateIndex
CREATE INDEX "posts_newsCardId_idx" ON "posts"("newsCardId");

-- CreateIndex
CREATE INDEX "posts_socialAccountId_idx" ON "posts"("socialAccountId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_sources" ADD CONSTRAINT "news_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_mappings" ADD CONSTRAINT "data_mappings_newsSourceId_fkey" FOREIGN KEY ("newsSourceId") REFERENCES "news_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_mappings" ADD CONSTRAINT "data_mappings_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_mappings" ADD CONSTRAINT "data_mappings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_cards" ADD CONSTRAINT "news_cards_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_cards" ADD CONSTRAINT "news_cards_dataMappingId_fkey" FOREIGN KEY ("dataMappingId") REFERENCES "data_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_newsCardId_fkey" FOREIGN KEY ("newsCardId") REFERENCES "news_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
