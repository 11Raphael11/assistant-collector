/*
  Warnings:

  - You are about to drop the `Ping` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Ping";

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brandColor" TEXT,
    "logoUrl" TEXT,
    "supportPhone" TEXT,
    "smsCreditBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);
