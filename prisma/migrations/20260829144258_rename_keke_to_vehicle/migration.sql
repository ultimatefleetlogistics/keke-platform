-- Hand-written replacement for what `prisma migrate dev --create-only`
-- generated. Prisma's own diff could not tell "renamed" from "deleted and
-- unrelated new one added", so its plan would have dropped the entire
-- `kekes` table and every `kekeId` column, permanently losing the 2
-- existing fleet vehicles and every contract, driver assignment,
-- maintenance record, ownership transfer, and document linked to them.
-- Every statement below is a rename, which Postgres performs in place
-- without touching the underlying rows, plus two additions that are safe
-- specifically because they are additive: the new `type` column on
-- `vehicles` (existing rows all default to KEKE, which is accurate, this
-- app's entire fleet so far has been kekes) and the new `SMS` value on
-- `NotificationChannel` (existing rows are untouched, this just makes SMS
-- valid going forward, for the Termii integration).

-- Rename the fleet status enum to match the renamed model. Existing
-- values (PENDING_ONBOARDING, ACTIVE, MAINTENANCE, UNASSIGNED, RETIRED)
-- are unchanged, only the type's own name changes.
ALTER TYPE "KekeStatus" RENAME TO "VehicleStatus";

-- Safe, additive: existing NotificationChannel rows are untouched, this
-- only makes SMS a valid value going forward.
ALTER TYPE "NotificationChannel" ADD VALUE 'SMS';

-- New enum for telling vehicle types apart. Not a rename, it did not
-- exist before.
CREATE TYPE "VehicleType" AS ENUM ('KEKE', 'CAR', 'BIKE');

-- Rename the fleet table itself. Every existing row (assetTag, status,
-- location, agent/driver links) is preserved, this only changes the name
-- Postgres and Prisma refer to it by.
ALTER TABLE "kekes" RENAME TO "vehicles";

-- Every fleet row that already exists predates VehicleType, so it
-- defaults to KEKE.
ALTER TABLE "vehicles" ADD COLUMN "type" "VehicleType" NOT NULL DEFAULT 'KEKE';

-- Constraint and index names, so a future `prisma migrate dev` diffs
-- against what Prisma actually expects for a table named "vehicles"
-- rather than showing a phantom rename every time it runs.
ALTER TABLE "vehicles" RENAME CONSTRAINT "kekes_pkey" TO "vehicles_pkey";
ALTER INDEX "kekes_assetTag_key" RENAME TO "vehicles_assetTag_key";
ALTER INDEX "kekes_frameNumber_key" RENAME TO "vehicles_frameNumber_key";
ALTER INDEX "kekes_plateNumber_key" RENAME TO "vehicles_plateNumber_key";
ALTER INDEX "kekes_currentDriverId_key" RENAME TO "vehicles_currentDriverId_key";
ALTER TABLE "vehicles" RENAME CONSTRAINT "kekes_agentId_fkey" TO "vehicles_agentId_fkey";
ALTER TABLE "vehicles" RENAME CONSTRAINT "kekes_currentDriverId_fkey" TO "vehicles_currentDriverId_fkey";

-- Rename every kekeId foreign key column to vehicleId. Renaming a column
-- that is part of an existing foreign key does not break the constraint
-- or touch the data, Postgres just starts calling the column by its new
-- name, the 2 existing investment_contracts rows (and any driver
-- assignment, maintenance, transfer, or document rows) keep exactly the
-- vehicle they already pointed at.
ALTER TABLE "driver_assignments" RENAME COLUMN "kekeId" TO "vehicleId";
ALTER TABLE "driver_assignments" RENAME CONSTRAINT "driver_assignments_kekeId_fkey" TO "driver_assignments_vehicleId_fkey";

ALTER TABLE "maintenance_records" RENAME COLUMN "kekeId" TO "vehicleId";
ALTER TABLE "maintenance_records" RENAME CONSTRAINT "maintenance_records_kekeId_fkey" TO "maintenance_records_vehicleId_fkey";

ALTER TABLE "investment_contracts" RENAME COLUMN "kekeId" TO "vehicleId";
ALTER TABLE "investment_contracts" RENAME CONSTRAINT "investment_contracts_kekeId_fkey" TO "investment_contracts_vehicleId_fkey";

ALTER TABLE "ownership_transfers" RENAME COLUMN "kekeId" TO "vehicleId";
ALTER TABLE "ownership_transfers" RENAME CONSTRAINT "ownership_transfers_kekeId_fkey" TO "ownership_transfers_vehicleId_fkey";

ALTER TABLE "documents" RENAME COLUMN "kekeId" TO "vehicleId";
ALTER TABLE "documents" RENAME CONSTRAINT "documents_kekeId_fkey" TO "documents_vehicleId_fkey";
