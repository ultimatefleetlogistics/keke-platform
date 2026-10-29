/**
 * Module 50: same fade-on-navigate as app/admin/template.tsx, applied to
 * the agent portal, see that file's own comment for the full reasoning.
 */
export default function AgentTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
