/**
 * Name of the private Supabase Storage bucket general documents (signed
 * contracts, maintenance receipts, asset photos) are uploaded to. Kept
 * separate from "kyc-documents" (lib/kyc-storage.ts) on purpose, an
 * investor's identity documents and a vehicle's maintenance receipts have
 * different visibility rules and no reason to share a bucket. Like that
 * one, this bucket is not created by migrations or seed scripts, Storage
 * buckets are a project-level setting: Storage -> New bucket -> name it
 * exactly "documents" -> leave it Private. See the README.
 */
export const DOCUMENT_BUCKET = "documents";

// Bigger than KYC's 5 MB, a scanned multi-page signed contract or a
// maintenance invoice with photos runs larger than a single ID photo.
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

export const ACCEPTED_DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
