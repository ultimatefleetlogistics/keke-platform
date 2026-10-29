import { KekeWatermark } from "@/components/design-system/keke-icon";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyKycDocuments } from "@/lib/data/kyc";
import { IdentityForm } from "@/app/kyc/identity-form";

export default async function KycPage() {
  const user = await getCurrentUser();
  const investor = user?.investor ?? null;
  const isVerified = investor?.kycStatus === "VERIFIED";
  const isPending = investor?.kycStatus === "PENDING_REVIEW";
  const documents = investor ? await getMyKycDocuments(investor.id) : { GOVERNMENT_ID: null, PROOF_OF_ADDRESS: null };

  // Only two real steps happen on this page: your personal details were
  // already collected at sign up, and identity verification is what the
  // form below does. Bank & payout details is a separate, already-working
  // page reached from the dashboard sidebar rather than a further step of
  // this wizard, and there is no distinct "review & submit" step anywhere
  // in the app, so neither is listed here, a step that isn't clickable
  // and leads nowhere is worse than no step at all.
  const steps = [
    { number: 1, label: "Personal details", status: "Completed", done: true },
    {
      number: 2,
      label: "Identity verification",
      status: isVerified ? "Completed" : isPending ? "Submitted, awaiting review" : "In progress",
      done: isVerified,
      current: !isVerified,
    },
  ];

  return (
    <div className="flex min-h-screen w-full overflow-hidden">
      <div className="relative hidden w-[400px] shrink-0 flex-col justify-between overflow-hidden bg-[linear-gradient(165deg,#1F1A12,#C9820A)] p-9 text-white lg:flex">
        <KekeWatermark className="absolute -bottom-2.5 -right-[70px] h-[230px] w-[300px]" opacity={0.13} />

        <div className="z-10 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 17h16M6 17V9.5a2 2 0 0 1 1-1.73l4.5-2.6a2 2 0 0 1 2 0l4.5 2.6a2 2 0 0 1 1 1.73V17"
                stroke="#C9820A"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8.5" cy="19.5" r="1.5" fill="#C9820A" />
              <circle cx="15.5" cy="19.5" r="1.5" fill="#C9820A" />
            </svg>
          </div>
          <span className="text-base font-extrabold">Ultimate</span>
        </div>

        <div className="z-10">
          <div className="mb-5.5 text-xs font-bold uppercase tracking-wide text-[#F5E4C3]">Get verified to invest</div>

          <div className="flex flex-col">
            {steps.map((step, index) => (
              <div key={step.number} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                      step.done ? "bg-white" : step.current ? "border-2 border-white bg-white text-[#7A4A05]" : "border-2 border-white/45 text-white/80"
                    }`}
                  >
                    {step.done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="m5 12 5 5L20 7" stroke="#7A4A05" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </div>
                  {index < steps.length - 1 ? <div className="mt-1 min-h-9 w-0.5 flex-1 bg-white/35" /> : null}
                </div>
                <div className="pb-6.5 pt-0.5">
                  <div className={`text-sm ${step.done || step.current ? "font-extrabold" : "font-bold text-white/80"}`}>{step.label}</div>
                  {step.status ? <div className="mt-0.5 text-xs text-[#F5E4C3]">{step.status}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="z-10 text-xs text-[#E9C98A]">Your documents are stored privately and only used for verification.</div>
      </div>

      <div className="flex flex-1 justify-center bg-background px-8 py-14">
        <div className="w-full max-w-[620px]">
          <div className="text-[23px] font-extrabold tracking-tight">Identity verification</div>
          <div className="mt-1.5 text-[13.5px] text-text-soft">
            We use this to confirm who you are before your first investment is activated
          </div>

          <div className="mt-7.5">
            <IdentityForm
              investor={investor ? { kycStatus: investor.kycStatus } : null}
              documents={documents}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
