"use client";

import { useRouter } from "next/navigation";

export default function LabSelector({ labs, currentLabId }: { labs: any[], currentLabId?: string }) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "all") {
      router.push("/admin/Analytics");
    } else {
      router.push(`/admin/Analytics?labId=${val}`);
    }
  };

  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
        Select Context
      </label>
      <select
        value={currentLabId || "all"}
        onChange={handleChange}
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm bg-white border"
      >
        <option value="all">All Labs (Cumulative)</option>
        {labs.map((lab) => (
          <option key={lab.id} value={lab.id}>
            {lab.title}
          </option>
        ))}
      </select>
    </div>
  );
}