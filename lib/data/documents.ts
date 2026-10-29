import { prisma } from "@/lib/prisma";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { DOCUMENT_BUCKET } from "@/lib/document-storage";

/**
 * Attaches a short-lived signed URL to each document, the bucket is
 * private, this is the only way to actually view a file in it, same
 * pattern as lib/data/kyc.ts's getInvestorKycDetail.
 */
async function withSignedUrls<T extends { storagePath: string }>(documents: T[]) {
  const supabase = createSupabaseServiceRoleClient();
  return Promise.all(
    documents.map(async (doc) => {
      const { data } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.storagePath, 60 * 10);
      return { ...doc, signedUrl: data?.signedUrl ?? null };
    })
  );
}

/** Every document attached to a specific contract, for the staff contract detail page, both STAFF_ONLY and PRIVATE_OWNER ones, staff can always see everything. */
export async function getContractDocuments(contractId: string) {
  const documents = await prisma.document.findMany({
    where: { contractId },
    orderBy: { createdAt: "desc" },
  });
  const withUrls = await withSignedUrls(documents);
  return withUrls.map((doc) => ({
    id: doc.id,
    type: doc.type,
    fileName: doc.fileName,
    visibility: doc.visibility,
    signedUrl: doc.signedUrl,
    createdAt: doc.createdAt.toISOString(),
  }));
}

/** Every document attached to a specific vehicle (not routed through any one contract), for the staff fleet detail page: maintenance receipts, asset photos, anything else about the vehicle itself. */
export async function getVehicleDocuments(vehicleId: string) {
  const documents = await prisma.document.findMany({
    where: { vehicleId },
    orderBy: { createdAt: "desc" },
  });
  const withUrls = await withSignedUrls(documents);
  return withUrls.map((doc) => ({
    id: doc.id,
    type: doc.type,
    fileName: doc.fileName,
    visibility: doc.visibility,
    signedUrl: doc.signedUrl,
    createdAt: doc.createdAt.toISOString(),
  }));
}

/**
 * Every document an investor is allowed to see themselves, for
 * /investor/documents: PRIVATE_OWNER documents attached to any contract
 * that belongs to them. A STAFF_ONLY document (most maintenance receipts,
 * for example) never appears here no matter which contract or vehicle
 * it's attached to, visibility is decided once, by staff, at upload time.
 */
export async function getInvestorVisibleDocuments(investorId: string) {
  const documents = await prisma.document.findMany({
    where: { visibility: "PRIVATE_OWNER", contract: { investorId } },
    include: { contract: { include: { vehicle: true } } },
    orderBy: { createdAt: "desc" },
  });
  const withUrls = await withSignedUrls(documents);
  return withUrls.map((doc) => ({
    id: doc.id,
    type: doc.type,
    fileName: doc.fileName,
    signedUrl: doc.signedUrl,
    vehicleAssetTag: doc.contract?.vehicle.assetTag ?? null,
    createdAt: doc.createdAt.toISOString(),
  }));
}
