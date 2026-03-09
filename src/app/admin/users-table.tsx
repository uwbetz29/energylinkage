"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import type { AdminUser } from "./actions";
import {
  listUsers,
  updateUserRole,
  createUser as createUserAction,
  deleteUser as deleteUserAction,
} from "./actions";
import { UserDetailDialog } from "./user-detail-dialog";
import { CreateUserDialog } from "./create-user-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    super_admin: "bg-red-50 text-red-700 border-red-200",
    admin: "bg-blue-50 text-blue-700 border-blue-200",
    member: "bg-gray-50 text-gray-600 border-gray-200",
  };
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    member: "Member",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[role] || styles.member}`}
    >
      {labels[role] || role}
    </span>
  );
}

type SortField =
  | "display_name"
  | "system_role"
  | "provider"
  | "created_at"
  | "last_sign_in_at";

export function UsersTable({ initialUsers }: { initialUsers: AdminUser[] }) {
  const router = useRouter();
  const { profile: myProfile } = useAuth();
  const isSuperAdmin = false; // TODO: add admin roles later
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.display_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField] || "";
      const bVal = b[sortField] || "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3.5 h-3.5 text-[#CCC]" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#93C90F]" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#93C90F]" />
    );
  };

  const refreshUsers = async () => {
    const updated = await listUsers();
    setUsers(updated);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(true);
    try {
      await updateUserRole(userId, newRole);
      await refreshUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser((prev) =>
          prev ? { ...prev, system_role: newRole } : null
        );
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    }
    setActionLoading(false);
  };

  const handleCreateUser = async (
    email: string,
    password: string,
    displayName: string,
    role: string
  ) => {
    setActionLoading(true);
    try {
      await createUserAction(email, password, displayName, role);
      await refreshUsers();
      setShowCreateDialog(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create user");
    }
    setActionLoading(false);
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await deleteUserAction(userId);
      await refreshUsers();
      setSelectedUser(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
    setActionLoading(false);
  };

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 h-9 bg-white border-[#E7E7E7]"
          />
        </div>
        <div className="flex-1" />
        <span className="text-sm text-[#999]">
          {filtered.length} user{filtered.length !== 1 ? "s" : ""}
        </span>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="h-9 bg-[#93C90F] hover:bg-[#86BB46] text-white gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Create User
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E7E7E7] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F0F0F0]">
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-[#999] uppercase tracking-wider cursor-pointer hover:text-[#555] select-none"
                onClick={() => toggleSort("display_name")}
              >
                <span className="flex items-center gap-1.5">
                  User <SortIcon field="display_name" />
                </span>
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-[#999] uppercase tracking-wider cursor-pointer hover:text-[#555] select-none"
                onClick={() => toggleSort("system_role")}
              >
                <span className="flex items-center gap-1.5">
                  Role <SortIcon field="system_role" />
                </span>
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-[#999] uppercase tracking-wider cursor-pointer hover:text-[#555] select-none"
                onClick={() => toggleSort("provider")}
              >
                <span className="flex items-center gap-1.5">
                  Provider <SortIcon field="provider" />
                </span>
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-[#999] uppercase tracking-wider cursor-pointer hover:text-[#555] select-none"
                onClick={() => toggleSort("created_at")}
              >
                <span className="flex items-center gap-1.5">
                  Created <SortIcon field="created_at" />
                </span>
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-[#999] uppercase tracking-wider cursor-pointer hover:text-[#555] select-none"
                onClick={() => toggleSort("last_sign_in_at")}
              >
                <span className="flex items-center gap-1.5">
                  Last Active <SortIcon field="last_sign_in_at" />
                </span>
              </th>
              <th className="w-[1%] px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((user) => (
              <tr
                key={user.id}
                className="border-b border-[#F8F8F8] last:border-0 hover:bg-[#93C90F]/5 cursor-pointer transition-colors group"
                onClick={() => setSelectedUser(user)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        className="w-8 h-8 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#93C90F] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {(user.display_name || user.email || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-[#222] truncate">
                        {user.display_name || "—"}
                      </div>
                      <div className="text-xs text-[#999] truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={user.system_role} />
                </td>
                <td className="px-4 py-3 text-sm text-[#666] capitalize">
                  {user.provider}
                </td>
                <td className="px-4 py-3 text-sm text-[#666]">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-[#666]">
                  {timeAgo(user.last_sign_in_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {user.system_role !== "super_admin" &&
                      user.id !== myProfile?.id && (
                        <button
                          className="p-1.5 rounded hover:bg-red-50 text-[#888] hover:text-red-500 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(user.id, user.display_name || user.email);
                          }}
                          title="Delete"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-[#999] text-sm"
                >
                  {search ? "No users match your search." : "No users found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* User Detail Dialog */}
      <UserDetailDialog
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onRoleChange={handleRoleChange}
        onDelete={handleDeleteUser}
        currentUserId={myProfile?.id || ""}
        isSuperAdmin={isSuperAdmin}
        loading={actionLoading}
      />

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateUser}
        isSuperAdmin={isSuperAdmin}
        loading={actionLoading}
      />
    </>
  );
}
