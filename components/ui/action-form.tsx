"use client";

import { createContext, useContext, useState, type FormEvent, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

type ActionResult = { error?: string } | void;

export interface ActionFormRenderState {
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Module 43: a drop-in replacement for a plain `<form action={someServerAction}>`
 * for any Server Action that can fail with a real, user-facing validation or
 * business-logic error. A raw `<form action={fn}>` bound to an action that
 * throws crashes straight to Next's generic error boundary the moment that
 * throw happens, there is nothing between the action and the DOM to catch it
 * and show a friendly message instead. This bug shape was found and fixed
 * reactively, one crash report at a time, six separate times before this
 * module (bootstrapFirstAdmin, retryAgentCollectionAccount,
 * updatePayoutDetails, matchProviderTransaction, dismissProviderTransaction,
 * createPaymentBatch, see CURRENT_STATE.md's "Known gaps"), each one hand
 * writing its own little Client Component with its own `isSubmitting`/`error`
 * state, e.g. `app/admin/payments/batches/new/new-batch-form.tsx`. Module 43
 * is the dedicated pass that entry kept flagging as still needed: every
 * remaining Server Action bound directly to a raw form, found by grepping
 * every "use server" file for a `throw` reachable from a plain form binding.
 * Rather than hand writing 32 more bespoke wrapper components, they all now
 * share this one.
 *
 * Every action wrapped here has been converted from throwing to returning
 * `{ error?: string }` (see each `lib/actions/*.ts` function's own comment),
 * so `handleSubmit` below deliberately never wraps the `action(...)` call in
 * a try/catch: a real, unexpected exception should still surface as a real
 * error, and more importantly, `redirect()` (used by several of these
 * actions on success, e.g. createDriver, createInvestor) works by throwing a
 * special Next.js digest error that a surrounding try/catch would swallow,
 * breaking the redirect. `revalidatePath()` calls inside these actions
 * refresh the current route's data on their own once the Server Action
 * response comes back, whether the action was invoked through a native form
 * submission or, as here, called directly, so no manual `router.refresh()`
 * is needed either, the same reasoning already relied on by the six earlier
 * conversions this module follows.
 *
 * `children` is plain JSX: a hidden id input plus, for the common case of a
 * submit button that needs to show a loading spinner while the request is
 * in flight, `ActionSubmitButton` (below) rather than a plain `<Button
 * type="submit">`. Module 43 originally shipped this as a render-prop,
 * `children={({ isSubmitting }) => (...)}`, so a caller could read
 * `isSubmitting` itself and pass `loading={isSubmitting}` to its own
 * `Button` directly. That crashed the first time this ran in a real
 * browser (reported directly: "Functions are not valid as a child of
 * Client Components," clicking into the wallet page), which this sandbox
 * never caught on its own, it has never had a real browser attached to
 * this app. The cause: almost every call site is written directly inside a
 * Server Component page, and a Server Component is not allowed to pass a
 * function as a Client Component's children, only plain, already-resolved
 * JSX, functions cannot cross that boundary at all. Fixed by moving
 * `isSubmitting`/`error` into `ActionFormContext` instead of handing them
 * to the caller through a function, so every call site could go back to
 * writing plain JSX, the same as any other children.
 */
const ActionFormContext = createContext<ActionFormRenderState | null>(null);

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const result = await action(formData);
    setIsSubmitting(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
    }
    // No error and no thrown redirect means the action's own redirect()
    // already took over navigation, see the doc comment above.
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <ActionFormContext.Provider value={{ isSubmitting, error }}>{children}</ActionFormContext.Provider>
      {error ? <p className="mt-2 text-[12.5px] font-medium text-bad-ink">{error}</p> : null}
    </form>
  );
}

/**
 * The `<Button type="submit">` to use for the submit button of an
 * `<ActionForm>`, anywhere that button should show a loading spinner while
 * the request is in flight (most of them, see `Button`'s own `loading` prop
 * doc comment for why that matters). Reads `isSubmitting` off
 * `ActionFormContext` instead of `useFormStatus`, unlike `SubmitButton`
 * (below): `ActionForm` submits through its own `onSubmit` handler, not a
 * native `<form action={fn}>` binding, so `useFormStatus`'s `pending` value
 * would never actually turn true inside it. Must be rendered somewhere
 * inside an `<ActionForm>`; outside one, `isSubmitting` reads as `false`
 * rather than throwing, so a stray use just never shows a spinner instead
 * of crashing the page.
 */
export function ActionSubmitButton({ children, ...props }: ButtonProps) {
  const state = useContext(ActionFormContext);
  return (
    <Button type="submit" loading={state?.isSubmitting ?? false} {...props}>
      {children}
    </Button>
  );
}
