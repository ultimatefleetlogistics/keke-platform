/**
 * Name of the private Supabase Storage bucket KYC documents (government ID,
 * proof of address) are uploaded to. This bucket is not created by
 * migrations or seed scripts, Storage buckets are a project-level setting,
 * not a database table, so it has to exist once in the Supabase dashboard
 * before the first upload: Storage -> New bucket -> name it exactly
 * "kyc-documents" -> leave it Private. See the README's KYC section.
 */
export const KYC_DOCUMENT_BUCKET = "kyc-documents";

export const MAX_KYC_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB, matches the limit already shown on the KYC page

export const ACCEPTED_KYC_DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
