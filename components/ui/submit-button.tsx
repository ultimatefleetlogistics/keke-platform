"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * A drop-in replacement for `<Button type="submit">` inside a plain
 * `<form action={someServerAction}>` (a Server Component form, no local
 * `isSubmitting` state of its own). `useFormStatus` only works for a
 * descendant of the form, not the form itself, so this one small piece
 * needs "use client" even though the page around it stays a Server
 * Component. Requested directly: "on the clickable buttons make them
 * reactive like an animation that shows that one has already clicked
 * them, something like a loading animation or hour glass."
 *
 * Client Component forms that already track their own `isSubmitting`
 * (the reconciliation, batch, and edit-page forms from Module 27) pass
 * `loading={isSubmitting}` to `Button` directly instead of using this,
 * since they already know their own pending state.
 */
export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  );
}
