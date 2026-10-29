"use client";

import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { ShieldFieldIcon } from "@/components/design-system/settings-icons";

type Stage = "loading" | "off" | "enrolling" | "on";

/**
 * Two-factor authentication (TOTP, an authenticator app like Google
 * Authenticator or Authy), shipped optional for every account type,
 * investor, agent, driver, staff, and Admin alike: "whenever you login
 * you should be able to see a settings that will have all those." Built
 * entirely on Supabase Auth's own MFA support (`supabase.auth.mfa.*`) run
 * client side against the signed-in user's own session, nothing here
 * needs the service role key or a new Prisma model or migration, Supabase
 * tracks enrolled factors itself.
 *
 * Deliberately optional, not required of anyone yet (a direct choice
 * when this was scoped): everyone gets this panel to turn it on if they
 * want, nobody is blocked from signing in or using the app without it.
 * When a factor IS enrolled, /sign-in and /admin-sign-in (the only two
 * password sign-in entry points) challenge for a 6-digit code after the
 * password succeeds, see their own comments for that half of the flow,
 * an enrolled factor that's never challenged would just be theater.
 *
 * Known gap, disclosed rather than silently left: the magic-link
 * ("send a login link by email") sign-in path on /sign-in does not
 * currently challenge for a second factor, only the password path does.
 *
 * Round twelve: rebuilt to render as one row inside the new "Security"
 * `SettingsGroup` (`components/design-system/settings-list.tsx`) rather
 * than its own separate bordered `Card`, direct feedback asking for
 * keke-mobile's new grouped Profile tab's look on the web too, and for
 * two-factor authentication specifically to look like a toggle
 * (`ToggleSwitch`, `components/ui/toggle-switch.tsx`), matching GTBank's
 * own switches and this round's identical change to keke-mobile's own
 * MFA row (`keke-mobile/src/app/(app)/profile.tsx` and
 * `two-factor-setup.tsx`). Turning it off is still a single click, no
 * confirmation step, that was already this component's behavior before
 * this round and stays that way, nothing about the underlying calls
 * changed. Turning it on can't honestly be instant, TOTP enrollment
 * needs a QR code scanned and a 6-digit code verified, so the toggle
 * itself only reflects on/off; tapping it while off expands the QR
 * panel below, in the same row's card, rather than flipping instantly.
 */
export function MfaSettings() {
  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (listError) {
        setError(listError.message);
        setStage("off");
        return;
      }
      const verifiedTotp = data.totp.find((factor) => factor.status === "verified");
      if (verifiedTotp) {
        setFactorId(verifiedTotp.id);
        setStage("on");
      } else {
        setStage("off");
      }
    });
  }, []);

  async function startEnrollment() {
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();

    // Starting over: an abandoned, never-verified factor from a previous
    // attempt would otherwise pile up and eventually hit Supabase's
    // per-user factor limit, clear any unverified ones first.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const factor of existing?.totp.filter((f) => f.status !== "verified") ?? []) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (enrollError) {
      setError(enrollError.message);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setCode("");
    setStage("enrolling");
  }

  async function confirmEnrollment(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setError(null);
    setBusy(true);

    const supabase = createSupabaseBrowserClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setBusy(false);
      setError(challengeError.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't match, check the time on your phone is correct and try again.");
      return;
    }

    setQrCode(null);
    setSecret(null);
    setCode("");
    setStage("on");
  }

  async function cancelEnrollment() {
    if (factorId) {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode("");
    setError(null);
    setStage("off");
  }

  async function turnOff() {
    if (!factorId) return;
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }
    setFactorId(null);
    setStage("off");
  }

  function handleToggle() {
    if (stage === "off") {
      startEnrollment();
    } else if (stage === "on") {
      turnOff();
    } else if (stage === "enrolling") {
      cancelEnrollment();
    }
  }

  const secondary =
    stage === "loading"
      ? "Checking your account's security settings..."
      : stage === "on"
        ? "On, a code from your authenticator app is asked for at sign in"
        : "Adds a 6-digit code from an authenticator app at sign in";

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center text-accent">
          <ShieldFieldIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold">Two-factor authentication</div>
          <div className="mt-0.5 text-[11.5px] text-text-faint">{secondary}</div>
        </div>
        {stage === "loading" ? null : (
          <ToggleSwitch checked={stage === "on" || stage === "enrolling"} onCheckedChange={handleToggle} disabled={busy} />
        )}
      </div>

      {stage === "enrolling" ? (
        <form onSubmit={confirmEnrollment} className="flex flex-col gap-4 border-t border-border px-4 py-4">
          <div className="text-[12.5px] text-text-soft">
            Scan this with an authenticator app (Google Authenticator, Authy, or similar), then enter the 6-digit code
            it shows to finish turning this on.
          </div>
          {qrCode ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrCode}
              alt="Scan this QR code with your authenticator app"
              className="h-[180px] w-[180px] self-start rounded-lg border border-border"
            />
          ) : null}
          {secret ? (
            <div className="rounded-xl border border-border bg-background px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                Can&apos;t scan? Enter this manually
              </div>
              <div className="mt-0.5 text-[13px] font-bold tracking-wide">{secret}</div>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mfa-code">6-digit code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
            />
          </div>
          {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}
          <div className="flex gap-3">
            <Button type="button" variant="outline" size="sm" onClick={cancelEnrollment} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy} loading={busy}>
              Verify &amp; turn on
            </Button>
          </div>
        </form>
      ) : error ? (
        <div className="border-t border-border px-4 py-3 text-[12.5px] font-medium text-bad-ink">{error}</div>
      ) : null}
    </div>
  );
}
