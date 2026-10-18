import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#f6f7f2] text-[#20251c]">
      <header className="sticky top-0 z-10 border-b border-[#e4e8dc] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#25351f] text-lg font-bold text-lime-200">
              O
            </span>
            <span>
              <span className="block text-lg font-bold tracking-tight">OpsDesk</span>
              <span className="hidden text-xs text-gray-500 sm:block">
                Operations workspace
              </span>
            </span>
          </NavLink>
          <nav aria-label="Main navigation" className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#edf2e4] text-[#304329]"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/items"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#edf2e4] text-[#304329]"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                }`
              }
            >
              Work items
            </NavLink>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-gray-600 sm:block">{user?.full_name}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}