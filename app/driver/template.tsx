/**
 * Module 50: same fade-on-navigate as app/admin/template.tsx, applied to
 * the driver portal, see that file's own comment for the full reasoning.
 */
export default function DriverTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
