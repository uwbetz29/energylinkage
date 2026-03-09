import { listUsers } from "./actions";
import { UsersTable } from "./users-table";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function AdminPage() {
  const users = await listUsers();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EDF5E0] via-[#F0F7E6] to-[#E8F0DB]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-[#888] hover:text-[#555] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="w-px h-5 bg-[#DDD]" />
          <h1 className="text-2xl font-semibold text-[#222]">
            User Management
          </h1>
        </div>

        <UsersTable initialUsers={users} />
      </div>
    </div>
  );
}
