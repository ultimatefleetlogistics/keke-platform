import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Ultimate — Keke Investment & Fleet Management";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Module 50: direct feedback, make the app feel more premium. Without
 * this, any link to the app shared outside it (WhatsApp, Slack, a text
 * to a client) rendered as a bare gray link card, no preview at all,
 * the single fastest way for an otherwise-polished app to look
 * unfinished the moment someone outside the team sees a link to it.
 * `app/opengraph-image.tsx` is a Next.js file convention: present at
 * this exact path, it's auto-detected and wired into this app's
 * `<head>` og:image/twitter:image tags for every route that doesn't
 * define its own, no manual `metadata.openGraph.images` entry needed
 * (see app/layout.tsx's own `metadataBase`, required for the relative
 * image URL this generates to resolve to an absolute one for crawlers).
 *
 * Module 60: the bell path (a placeholder standing in for a brand mark
 * that didn't exist yet) is now the client's real logo icon
 * (public/brand/icon.png, same file app-shell.tsx and the auth screens
 * use), read and base64-encoded the same way the two font files below
 * already are rather than inlining a giant base64 literal into this
 * file's source. The container went from the product's gold accent to
 * white for the same reason every other placement of this icon does:
 * the icon's own blue/gold only reads correctly on a light surface, and
 * this image's background is a dark charcoal gradient.
 *
 * Fonts are read from `.ttf` siblings of the `.woff2` files app/layout.tsx
 * loads (see that file's own comment on why local over next/font/google).
 * Deliberately not the same `.woff2` files: next/og's renderer (Satori,
 * via opentype.js) can only parse TrueType/OpenType outlines, not WOFF2's
 * brotli-compressed table format, and fails the whole build with
 * "Unsupported OpenType signature wOF2" if pointed at one. The two `.ttf`
 * files here are the exact same Plus Jakarta Sans 500/800 glyphs, just
 * decompressed back to plain TrueType, so this route always matches
 * whatever weight app/layout.tsx is actually shipping to the browser.
 * `runtime = "nodejs"` because reading local files needs node:fs,
 * unavailable on the edge runtime this file convention otherwise
 * defaults to.
 */
export default async function OpengraphImage() {
  const [bold, medium, iconPng] = await Promise.all([
    readFile(join(process.cwd(), "app/fonts/plus-jakarta-sans/plus-jakarta-sans-800.ttf")),
    readFile(join(process.cwd(), "app/fonts/plus-jakarta-sans/plus-jakarta-sans-500.ttf")),
    readFile(join(process.cwd(), "public/brand/icon.png")),
  ]);
  const iconDataUrl = `data:image/png;base64,${iconPng.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "84px",
          background: "linear-gradient(135deg, #1F1A12 0%, #2b2210 55%, #1F1A12 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 44 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              background: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori (next/og's renderer) needs a plain <img>, not next/image */}
            <img src={iconDataUrl} width={40} height={53} alt="" />
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: "#F5F7F3" }}>Ultimate</div>
        </div>
        <div style={{ fontSize: 30, fontWeight: 500, color: "#E0A335", maxWidth: 920, lineHeight: 1.4 }}>
          Track every vehicle, every investor, every naira, all in one place.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Plus Jakarta Sans", data: bold, weight: 800, style: "normal" },
        { name: "Plus Jakarta Sans", data: medium, weight: 500, style: "normal" },
      ],
    }
  );
}
