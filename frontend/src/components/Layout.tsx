import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="text-lg font-bold">OpsDesk</span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">{user?.full_name}</span>
            <button
              onClick={logout}
              className="rounded border px-3 py-1 hover:bg-gray-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}