import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Requested directly: a clicked button should "feel like it has been
  // clicked... rather than sitting down and doing nothing," most visible
  // on a plain Server Component form (SubmitButton), where there is a real
  // gap between the click and the spinner actually appearing, the request
  // itself has to leave the browser and come back before React even knows
  // to show `pending`. `active:scale-[0.97]` needs none of that, it is a
  // pure CSS pseudo-class, so it fires the instant the mouse (or a tap)
  // goes down, before any JavaScript runs at all, closing exactly that
  // gap. The transition list is spelled out explicitly
  // (`transition-[color,background-color,border-color,box-shadow,transform]`)
  // rather than stacking a second Tailwind `transition-*` utility next to
  // this one, two of those utilities both set the same underlying
  // `transition-property` CSS property, so the second one silently wins
  // instead of adding to the first, spelling the whole list out once
  // avoids that trap.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] active:duration-100 disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white shadow-[0_6px_16px_rgba(201,130,10,0.28)] hover:bg-accent-dark",
        outline:
          "border border-border bg-surface text-text hover:bg-background",
        ghost: "text-text-soft hover:bg-background hover:text-text",
        subtle: "bg-accent-soft text-accent-dark hover:bg-accent-soft/80",
        destructive: "bg-bad text-white hover:bg-bad-ink",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-3.5 text-[13px]",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Shows a small spinner in place of the button's own leading icon (if
   * any) and disables the button. Requested directly: "on the clickable
   * buttons make them reactive like an animation that shows that one has
   * already clicked them, something like a loading animation or hour
   * glass." Not used with `asChild`, a Link rendered through `asChild`
   * has no pending state of its own to show a spinner for.
   */
  loading?: boolean;
}

const Spinner = () => (
  <svg
    className="h-3.5 w-3.5 shrink-0 animate-spin"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
    <path
      className="opacity-90"
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Spinner /> : null}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
