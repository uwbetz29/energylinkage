"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { ChannelManager } from "@/lib/realtime/channel-manager";
import type { RealtimeOperation, PresenceState } from "@/lib/realtime/operations";

export function useRealtime(projectId: string | null) {
  const { user, profile, supabase } = useAuth();
  const managerRef = useRef<ChannelManager | null>(null);
  const [presenceUsers, setPresenceUsers] = useState<PresenceState[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const operationHandlersRef = useRef<Set<(op: RealtimeOperation) => void>>(
    new Set()
  );

  // Create manager once
  useEffect(() => {
    if (!user || !profile || !supabase) return;

    managerRef.current = new ChannelManager(
      supabase,
      user.id,
      profile.display_name || profile.email || "Unknown",
      profile.avatar_url
    );

    return () => {
      managerRef.current?.leave();
      managerRef.current = null;
      setIsConnected(false);
      setPresenceUsers([]);
    };
  }, [user, profile, supabase]);

  // Join/leave project channel
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !projectId) return;

    manager.join(
      projectId,
      (op) => {
        operationHandlersRef.current.forEach((h) => h(op));
      },
      (users) => {
        setPresenceUsers(users);
        setIsConnected(true);
      }
    );

    return () => {
      manager.leave();
      setIsConnected(false);
      setPresenceUsers([]);
    };
  }, [projectId, managerRef.current]);

  const broadcast = useCallback(
    (op: Omit<RealtimeOperation, "userId" | "timestamp">) => {
      managerRef.current?.broadcast(op);
    },
    []
  );

  const onOperation = useCallback(
    (handler: (op: RealtimeOperation) => void) => {
      operationHandlersRef.current.add(handler);
      return () => {
        operationHandlersRef.current.delete(handler);
      };
    },
    []
  );

  // Filter out self from presence
  const otherUsers = presenceUsers.filter((u) => u.userId !== user?.id);

  return {
    presenceUsers: otherUsers,
    allPresenceUsers: presenceUsers,
    isConnected,
    broadcast,
    onOperation,
  };
}
