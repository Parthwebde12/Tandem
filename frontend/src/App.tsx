import { useQuery } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";

function Home() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error("API down");
      return res.json() as Promise<{ status: string }>;
    },
  });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">OpsDesk</h1>
      <p className="mt-2 text-sm text-gray-600">
        API: {isLoading ? "checking..." : isError ? "unreachable" : data?.status}
      </p>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}