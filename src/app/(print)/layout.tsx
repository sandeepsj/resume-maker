// Minimal layout for print pages — no sidebar, no nav.
// The root layout (html/body) still wraps this.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
