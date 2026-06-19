-- CreateEnum
CREATE TYPE "PaymentLogStatus" AS ENUM ('pending', 'paid', 'failed');

-- CreateTable
CREATE TABLE "PaymentToken" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amountRial" INTEGER NOT NULL,
    "status" "PaymentLogStatus" NOT NULL DEFAULT 'pending',
    "authority" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentToken_token_key" ON "PaymentToken"("token");

-- CreateIndex
CREATE INDEX "PaymentToken_businessId_expiresAt_idx" ON "PaymentToken"("businessId", "expiresAt");

-- CreateIndex
CREATE INDEX "PaymentToken_installmentId_idx" ON "PaymentToken"("installmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLog_transactionId_key" ON "PaymentLog"("transactionId");

-- CreateIndex
CREATE INDEX "PaymentLog_businessId_createdAt_idx" ON "PaymentLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentLog_installmentId_idx" ON "PaymentLog"("installmentId");

-- AddForeignKey
ALTER TABLE "PaymentToken" ADD CONSTRAINT "PaymentToken_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentToken" ADD CONSTRAINT "PaymentToken_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
