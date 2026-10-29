/**
 * Module 50: direct feedback, make the app feel more premium — ordinary
 * navigation inside the admin console used to swap page content
 * instantly, the one moment in this app that reads as an "app" doing
 * something (sign-in/out's own slide-in, see app/sign-in/page.tsx) was
 * otherwise limited to those two screens. A `template.tsx`, unlike this
 * folder's own `layout.tsx`, remounts fresh on every navigation within
 * it, which is exactly the behavior a re-triggered entrance animation
 * needs (a persistent layout would only ever animate once, on first
 * load). `.animate-page-in` (app/globals.css) is a short opacity-only
 * fade, `prefers-reduced-motion`-aware, deliberately not the sign-in
 * page's own slide so ordinary in-app navigation never competes with
 * that one "arriving" moment.
 */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
