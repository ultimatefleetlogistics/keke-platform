"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

/**
 * A naira amount field that shows thousands separators while you type
 * (3,850,000 instead of 3850000) but still submits a plain number, so the
 * server actions that read these fields with Number(formData.get(...))
 * need no change. The visible box has no `name`, the hidden input next to
 * it carries the raw value.
 */
function groupDigits(raw: string): string {
  const [intPart, decPart] = raw.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart === undefined ? grouped : `${grouped}.${decPart}`;
}

function toDisplay(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "";
  return groupDigits(String(value));
}

function sanitize(input: string): string {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  const intPart = cleaned.slice(0, firstDot);
  const decPart = cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  return `${intPart}.${decPart}`;
}

export function MoneyInput({
  id,
  name,
  value,
  onValueChange,
  required,
}: {
  id: string;
  name: string;
  value: number;
  onValueChange: (value: number) => void;
  required?: boolean;
}) {
  const [text, setText] = React.useState(() => toDisplay(value));

  // The parent can change the value on its own (picking a different vehicle
  // pre-fills new terms), keep what's shown in step with that without
  // fighting someone who is mid-typing, e.g. "1000." (a trailing dot).
  React.useEffect(() => {
    const typed = Number(text.replace(/,/g, ""));
    if ((Number.isFinite(typed) ? typed : 0) !== value) setText(toDisplay(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13.5px] font-semibold text-text-soft">
        ₦
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        className="pl-8"
        value={text}
        onChange={(e) => {
          const raw = sanitize(e.target.value);
          setText(groupDigits(raw));
          const parsed = Number(raw);
          onValueChange(Number.isFinite(parsed) ? parsed : 0);
        }}
      />
      <input type="hidden" name={name} value={String(value)} />
    </div>
  );
}
