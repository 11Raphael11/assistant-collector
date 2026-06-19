-- CreateEnum
CREATE TYPE "FollowUpEventType" AS ENUM ('promise_to_pay', 'extension_request', 'note');

-- CreateTable
CREATE TABLE "FollowUpEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "installmentId" TEXT,
    "type" "FollowUpEventType" NOT NULL,
    "promisedDate" TIMESTAMP(3),
    "note" TEXT,
    "seenByBusiness" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUpEvent_businessId_seenByBusiness_idx" ON "FollowUpEvent"("businessId", "seenByBusiness");

-- CreateIndex
CREATE INDEX "FollowUpEvent_businessId_promisedDate_idx" ON "FollowUpEvent"("businessId", "promisedDate");

-- CreateIndex
CREATE INDEX "FollowUpEvent_customerId_idx" ON "FollowUpEvent"("customerId");

-- CreateIndex
CREATE INDEX "FollowUpEvent_installmentId_idx" ON "FollowUpEvent"("installmentId");

-- AddForeignKey
ALTER TABLE "FollowUpEvent" ADD CONSTRAINT "FollowUpEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpEvent" ADD CONSTRAINT "FollowUpEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpEvent" ADD CONSTRAINT "FollowUpEvent_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
