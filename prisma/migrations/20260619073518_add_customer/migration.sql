-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "phoneEnc" BYTEA NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneLast4" TEXT NOT NULL,
    "nationalIdEnc" BYTEA,
    "nationalIdHash" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_businessId_idx" ON "Customer"("businessId");

-- CreateIndex
CREATE INDEX "Customer_businessId_nameNormalized_idx" ON "Customer"("businessId", "nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_phoneHash_key" ON "Customer"("businessId", "phoneHash");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
