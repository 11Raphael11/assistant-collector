-- CreateTable
CREATE TABLE "RateBucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMPTZ NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RateBucket_pkey" PRIMARY KEY ("key","windowStart")
);
