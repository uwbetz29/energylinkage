"use client";

import { useState } from "react";
import type { AdminUser } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Clock, Mail, UserCheck } from "lucide-react";

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
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[role] || styles.member}`}
    >
      {labels[role] || role}
    </span>
  );
}

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

interface UserDetailDialogProps {
  user: AdminUser | null;
  onClose: () => void;
  onRoleChange: (userId: string, newRole: string) => Promise<void>;
  onDelete: (userId: string, name: string) => Promise<void>;
  currentUserId: string;
  isSuperAdmin: boolean;
  loading: boolean;
}

export function UserDetailDialog({
  user,
  onClose,
  onRoleChange,
  onDelete,
  currentUserId,
  isSuperAdmin,
  loading,
}: UserDetailDialogProps) {
  const [pendingRole, setPendingRole] = useState<string | null>(null);

  if (!user) return null;

  const isOwnProfile = user.id === currentUserId;
  const canEditRole =
    !isOwnProfile &&
    user.system_role !== "super_admin" &&
    (isSuperAdmin || user.system_role === "member");

  const handleRoleChange = async (newRole: string) => {
    setPendingRole(newRole);
    await onRoleChange(user.id, newRole);
    setPendingRole(null);
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Profile header */}
          <div className="flex items-center gap-4">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#93C90F] flex items-center justify-center text-white text-lg font-semibold">
                {(user.display_name || user.email || "U")[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-[#222] text-base truncate">
                {user.display_name || "—"}
              </h3>
              <p className="text-sm text-[#888] truncate">{user.email}</p>
            </div>
            <RoleBadge role={pendingRole || user.system_role} />
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-[#666]">
              <Mail className="w-3.5 h-3.5 text-[#999]" />
              <span>Provider: </span>
              <span className="font-medium capitalize">{user.provider}</span>
            </div>
            <div className="flex items-center gap-2 text-[#666]">
              <Clock className="w-3.5 h-3.5 text-[#999]" />
              <span>Created: </span>
              <span className="font-medium">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#666] col-span-2">
              <UserCheck className="w-3.5 h-3.5 text-[#999]" />
              <span>Last active: </span>
              <span className="font-medium">
                {timeAgo(user.last_sign_in_at)}
              </span>
            </div>
          </div>

          {/* Role change */}
          {canEditRole && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#999] uppercase tracking-wider block">
                Change Role
              </label>
              <div className="flex gap-2">
                {(isSuperAdmin
                  ? ["member", "admin", "super_admin"]
                  : ["member", "admin"]
                ).map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    disabled={
                      loading || (pendingRole || user.system_role) === role
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      (pendingRole || user.system_role) === role
                        ? "bg-[#93C90F]/10 border-[#93C90F] text-[#5A7E00]"
                        : "bg-white border-[#E7E7E7] text-[#666] hover:border-[#93C90F]/40 hover:bg-[#93C90F]/5"
                    } disabled:opacity-50`}
                  >
                    {role === "super_admin"
                      ? "Super Admin"
                      : role.charAt(0).toUpperCase() + role.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!isOwnProfile && user.system_role !== "super_admin" && (
            <Button
              variant="outline"
              onClick={() =>
                onDelete(user.id, user.display_name || user.email)
              }
              disabled={loading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
