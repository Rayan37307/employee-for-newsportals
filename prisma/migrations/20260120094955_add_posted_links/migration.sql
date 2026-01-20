-- CreateTable
CREATE TABLE "posted_links" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'bangladesh_guardian',
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posted_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "posted_links_url_key" ON "posted_links"("url");

-- CreateIndex
CREATE INDEX "posted_links_url_idx" ON "posted_links"("url");

-- CreateIndex
CREATE INDEX "posted_links_source_idx" ON "posted_links"("source");
