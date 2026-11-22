import type { Metadata } from "next";

import { LegalPage, LegalSection, LegalList } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Ultimate Fleet Logistics",
  description:
    "What personal information Ultimate Fleet Logistics collects, why, who we share it with, and the choices you have.",
};

/**
 * Module: public privacy policy. Added 2026-11-22, a hard requirement of
 * both the App Store and Google Play (the listing must link to a live
 * policy URL). The wording was checked against what this codebase
 * actually collects and which providers it talks to (Supabase, Paystack,
 * Resend, Termii, Vercel, optional Sentry, no BVN/NIN since the Dojah
 * step-down, biometric unlock on-device only). If any of that changes,
 * change this page in the same commit.
 *
 * PRIVACY_EMAIL is a separate mailbox from CONTACT_EMAIL on purpose:
 * data-protection requests (access, correction, deletion) should not get
 * lost in the general inbox.
 */
const PRIVACY_EMAIL = "privacy@ultimatefleetlogisticsltd.com";
const UPDATED = "22 November 2026";

const COLLECTED: { what: string; details: string; from: string }[] = [
  {
    what: "Account details",
    details:
      "Full name, email address, phone number, and your password (kept protected by our sign-in provider; we cannot read it).",
    from: "You, or our team when we create your account.",
  },
  {
    what: "Identity documents",
    details: "A government-issued ID and proof of address, as image or PDF files, plus the review status of each.",
    from: "You, when you upload them on the verification page.",
  },
  {
    what: "Payout bank details",
    details: "Bank name, account number and account name.",
    from: "You, so we can pay you.",
  },
  {
    what: "Payment and wallet records",
    details:
      "Deposits, payments, payouts, wallet balance and history, and the dedicated deposit account number issued to you through Paystack.",
    from: "Generated as you use the service.",
  },
  {
    what: "Agreement and vehicle records",
    details:
      "The terms of your agreement, the vehicle linked to it, payment schedules and ownership transfers, and the time and network address (IP) when you accepted an agreement online.",
    from: "You and our team.",
  },
  {
    what: "Agent and driver records",
    details: "Names, phone numbers, documents and remittance history that our staff enter on their behalf.",
    from: "Our staff, from information the agent or driver gives us.",
  },
  {
    what: "Activity and security records",
    details:
      "A log of actions taken in the platform (who did what, and when), sign-in and two-factor settings, and the notifications we sent you.",
    from: "Generated as you use the service.",
  },
  {
    what: "Device and technical data",
    details:
      "A sign-in session stored securely on your phone, and error reports if error monitoring is switched on for the website.",
    from: "Your device and our systems.",
  },
];

const SHARED: { provider: string; role: string; data: string }[] = [
  {
    provider: "Payment provider (Paystack)",
    role: "Receives deposits, issues your deposit account number, and sends payouts",
    data: "Name, email, phone, bank details, payment amounts",
  },
  {
    provider: "Cloud database and file storage provider",
    role: "Runs sign-in, stores our records, and holds uploaded documents in private storage",
    data: "Account details, records, uploaded documents",
  },
  {
    provider: "Email provider",
    role: "Sends our emails to you",
    data: "Name, email address, message content",
  },
  {
    provider: "SMS provider",
    role: "Sends our text messages to you",
    data: "Phone number, message content",
  },
  {
    provider: "Website hosting provider",
    role: "Hosts the website and its servers",
    data: "Technical request data",
  },
  {
    provider: "Error monitoring provider",
    role: "Helps us find and fix website errors, only if switched on",
    data: "Technical error details",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy" updated={UPDATED}>
      <LegalSection title="Who we are and what this covers">
        <p>
          Ultimate Fleet Logistics Ltd (&quot;Ultimate Fleet&quot;, &quot;we&quot;, &quot;us&quot;) is a company
          registered in Nigeria (CAC registration number 7250368). Our office is at Plot C8, 521 Road, 5th Avenue
          off 1st Avenue, Gwarinpa, Abuja.
        </p>
        <p>
          This policy explains what personal information we collect when you use our website
          (www.ultimatefleetlogisticsltd.com) and the Ultimate Fleet mobile app, why we collect it, who we share it
          with, and what choices you have. It applies to clients and partners with an account, agents, drivers, and
          anyone who visits the website or contacts us.
        </p>
        <p>
          Most accounts are created for you by our team. If we created your account, we will have given you a
          temporary password and asked you to change it the first time you sign in.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p>We collect only what we need to run your account, verify who you are, and move money to and from you correctly.</p>
        <div className="space-y-3">
          {COLLECTED.map((row) => (
            <div key={row.what} className="rounded-xl border border-border bg-surface p-4">
              <div className="text-[14.5px] font-bold text-text">{row.what}</div>
              <p className="mt-1 text-[14px] leading-relaxed">{row.details}</p>
              <p className="mt-1 text-[12.5px] text-text-faint">Comes from: {row.from}</p>
            </div>
          ))}
        </div>
        <p>
          We do not currently ask for your BVN or NIN. The mobile app does not ask for access to your location,
          contacts, camera or microphone, and it does not contain advertising or analytics tools.
        </p>
        <p>If you email or call us, we keep the message and your contact details so we can respond.</p>
      </LegalSection>

      <LegalSection title="How we use your information">
        <p>
          We use your information to provide the service you signed up for, and for nothing unrelated to it.
          Specifically, we use it to:
        </p>
        <LegalList
          items={[
            "create and secure your account, including sign-in and two-factor protection;",
            "check who you are, by having our staff review the documents you upload;",
            "manage your agreement, the vehicle linked to it, your payment schedule and any ownership transfer;",
            "receive deposits and make payouts, and keep an accurate record of every payment;",
            "send you service messages by email and SMS, such as payment confirmations and account notices;",
            "keep records we are required to keep, detect fraud and misuse, and resolve disputes; and",
            "answer your questions and requests.",
          ]}
        />
        <p>
          We do not sell your personal information, and we do not use it for advertising. Our lawful grounds under the
          Nigeria Data Protection Act 2023 are performing our agreement with you, meeting our legal obligations, our
          legitimate interest in running and securing the service, and your consent where we ask for it.
        </p>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>
          We share personal information only with the service providers that help us run the platform, and only what
          each one needs for its job.
        </p>
        <div className="space-y-3">
          {SHARED.map((row) => (
            <div key={row.provider} className="rounded-xl border border-border bg-surface p-4">
              <div className="text-[14.5px] font-bold text-text">{row.provider}</div>
              <p className="mt-1 text-[14px] leading-relaxed">{row.role}</p>
              <p className="mt-1 text-[12.5px] text-text-faint">Information involved: {row.data}</p>
            </div>
          ))}
        </div>
        <p>
          These providers process information on our behalf and under their own security and privacy terms. Some of
          them operate outside Nigeria, so your information may be handled in other countries; where that happens we
          rely on providers that apply appropriate safeguards.
        </p>
        <p>
          We may also disclose information if the law, a court or a regulator requires it, or to our professional
          advisers under a duty of confidentiality. We will not give your information to anyone else without telling
          you first.
        </p>
      </LegalSection>

      <LegalSection title="How we protect it">
        <p>
          Uploaded identity documents are kept in private storage that is not open to the public, and they are only
          opened by authorised staff for review. Staff accounts are limited by role, so each team member can reach only
          what their job needs, and important actions are written to an activity log. Our database is locked down so
          that it can only be reached through our own application, and you can add two-factor protection to your
          account.
        </p>
        <p>
          The mobile app can unlock with Face ID or your fingerprint if your phone supports it. The check is done
          entirely by your phone&apos;s own system: the app is told only whether it passed, and we never receive, see
          or store your face or fingerprint data. Your sign-in session is kept in your phone&apos;s secure storage.
        </p>
        <p>
          No system is perfectly secure. If you think someone has accessed your account, change your password and
          contact us straight away.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it, your rights, and deleting your account">
        <p>
          We keep your information while your account is open. After it closes, we keep your financial, contract and
          identity-verification records for 6 years, because Nigerian company, tax and anti-money-laundering rules
          require us to keep records of this kind for 5 to 6 years. Everything else is deleted within 6 months of your
          account closing. After the 6 years we delete or anonymise what is left.
        </p>
        <p>Under the Nigeria Data Protection Act 2023 you can ask us to:</p>
        <LegalList
          items={[
            "tell you what personal information we hold about you, and give you a copy;",
            "correct anything that is wrong or out of date;",
            "delete your information, where we have no legal reason to keep it;",
            "stop or limit how we use it, or object to a particular use;",
            "move your information to another provider in a common format; and",
            "withdraw any consent you gave us.",
          ]}
        />
        <p>
          To use any of these rights, or to ask us to delete your account, email{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} className="font-semibold text-accent-dark underline">
            {PRIVACY_EMAIL}
          </a>{" "}
          from the address on your account. We may need to confirm it is really you first. We will answer promptly and
          tell you if we cannot do something and why. If you are not happy with our answer, you can complain to the
          Nigeria Data Protection Commission.
        </p>
      </LegalSection>

      <LegalSection title="Children, changes, and contact">
        <p>
          Our service is for adults. We do not knowingly collect information from anyone under 18, and if we learn that
          we have, we will delete it.
        </p>
        <p>
          We may update this policy from time to time. When we do, we will change the date at the top of this page, and
          for significant changes we will also tell account holders by email or in the app.
        </p>
        <p>
          Questions or requests about your privacy:{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} className="font-semibold text-accent-dark underline">
            {PRIVACY_EMAIL}
          </a>
          , or call 0901 950 5552 or 0803 939 2901.
        </p>
        <p>Ultimate Fleet Logistics Ltd, Plot C8, 521 Road, 5th Avenue off 1st Avenue, Gwarinpa, Abuja, Nigeria.</p>
      </LegalSection>
    </LegalPage>
  );
}
