import { useAuth } from "../auth/useAuth";

export default function Home() {
  const { user } = useAuth();

  return (
    <section>
      <h1 className="text-2xl font-bold">Welcome, {user?.full_name}</h1>
      <h2 className="mt-6 text-sm font-semibold uppercase text-gray-500">
        Your teams
      </h2>
      <ul className="mt-2 space-y-2">
        {user?.memberships.map((m) => (
          <li
            key={m.team_id}
            className="flex items-center justify-between rounded border bg-white px-4 py-3"
          >
            <span>{m.team_name}</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
              {m.role}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-gray-500">
        Work items will appear here once the item endpoints are built.
      </p>
    </section>
  );
}