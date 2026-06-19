-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('pending', 'due_soon', 'overdue', 'promised', 'partially_paid', 'paid', 'in_legal', 'canceled');

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "amountRial" INTEGER NOT NULL,
    "paidAmountRial" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'pending',
    "lastReminderStage" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Installment_dueDate_status_idx" ON "Installment"("dueDate", "status");

-- CreateIndex
CREATE INDEX "Installment_businessId_status_idx" ON "Installment"("businessId", "status");

-- CreateIndex
CREATE INDEX "Installment_contractId_idx" ON "Installment"("contractId");

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
