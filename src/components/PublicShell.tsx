import Logo from "./Logo";

// Marco de las páginas que ve el cliente sin cuenta.
export default function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="bg-ink px-4 py-4" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <div className="mx-auto max-w-2xl"><Logo size={30} /></div>
      </header>
      <main className="mx-auto grid max-w-2xl gap-6 px-4 py-8 pb-16" style={{ paddingLeft: "max(16px, env(safe-area-inset-left))", paddingRight: "max(16px, env(safe-area-inset-right))" }}>{children}</main>
    </div>
  );
}
