import { Link, Outlet } from "react-router-dom";

const linkClass =
  "text-sm font-medium text-zinc-400 transition hover:text-emerald-400/90";

export function SiteLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
          <Link to="/" className={linkClass}>
            Home
          </Link>
          <Link to="/sign-in" className={linkClass}>
            Sign in
          </Link>
          <Link to="/chat" className={linkClass}>
            Chat
          </Link>
          <Link to="/billing" className={linkClass}>
            Billing
          </Link>
          <Link to="/admin" className={linkClass}>
            Admin
          </Link>
        </nav>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
