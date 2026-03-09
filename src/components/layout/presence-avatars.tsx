"use client";

import type { PresenceState } from "@/lib/realtime/operations";

interface PresenceAvatarsProps {
  users: PresenceState[];
  maxVisible?: number;
}

export function PresenceAvatars({
  users,
  maxVisible = 4,
}: PresenceAvatarsProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user) => (
        <div
          key={user.userId}
          className="relative"
          title={user.displayName}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-6 h-6 rounded-full border-2 border-white"
            />
          ) : (
            <div
              className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold"
              style={{ backgroundColor: user.color }}
            >
              {user.displayName[0]?.toUpperCase() || "?"}
            </div>
          )}
          {/* Online dot */}
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white"
            style={{ backgroundColor: user.color }}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full border-2 border-white bg-[#E7E7E7] flex items-center justify-center text-[9px] font-semibold text-[#666]">
          +{overflow}
        </div>
      )}
    </div>
  );
}
