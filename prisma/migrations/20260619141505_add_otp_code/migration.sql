-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpCode_phoneHash_expiresAt_idx" ON "OtpCode"("phoneHash", "expiresAt");
