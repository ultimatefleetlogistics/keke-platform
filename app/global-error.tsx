"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Catches an error thrown by the root layout itself, the one place
 * app/error.tsx cannot help, since a boundary can't catch an error in
 * whatever renders it. Next.js requires this file to render its own
 * <html>/<body>, the root layout is gone at this point, so this cannot
 * rely on globals.css or any shared component, it is plain inline styles
 * on purpose. This should be rare in practice, the root layout here is
 * just a font and a metadata block, but Sentry still needs to hear about
 * it if it ever happens.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#F5F7F3",
          color: "#14171A",
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: 800 }}>Something went wrong</div>
        <div style={{ maxWidth: "360px", fontSize: "13.5px", color: "#5B6058" }}>
          This has already been reported. Reloading the page usually fixes it.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "8px",
            height: "40px",
            padding: "0 20px",
            borderRadius: "12px",
            border: "none",
            background: "#C9820A",
            color: "white",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
