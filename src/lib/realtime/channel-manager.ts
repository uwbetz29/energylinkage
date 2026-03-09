import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeOperation, PresenceState } from "./operations";
import { getUserColor, validateOperation } from "./operations";

type OperationHandler = (op: RealtimeOperation) => void;
type PresenceHandler = (users: PresenceState[]) => void;

export class ChannelManager {
  private supabase: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private projectId: string | null = null;
  private userId: string;
  private displayName: string;
  private avatarUrl: string | null;
  private onOperation: OperationHandler | null = null;
  private onPresence: PresenceHandler | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    supabase: SupabaseClient,
    userId: string,
    displayName: string,
    avatarUrl: string | null
  ) {
    this.supabase = supabase;
    this.userId = userId;
    this.displayName = displayName;
    this.avatarUrl = avatarUrl;
  }

  join(
    projectId: string,
    onOperation: OperationHandler,
    onPresence: PresenceHandler
  ) {
    // Leave previous channel
    if (this.channel) {
      this.leave();
    }

    this.projectId = projectId;
    this.onOperation = onOperation;
    this.onPresence = onPresence;

    const channelName = `project:${projectId}`;
    this.channel = this.supabase.channel(channelName, {
      config: { presence: { key: this.userId } },
    });

    // Listen for broadcast operations
    this.channel.on("broadcast", { event: "operation" }, ({ payload }) => {
      if (validateOperation(payload) && payload.userId !== this.userId) {
        this.onOperation?.(payload);
      }
    });

    // Listen for presence changes
    this.channel.on("presence", { event: "sync" }, () => {
      const state = this.channel?.presenceState() ?? {};
      const users: PresenceState[] = [];

      for (const [, presences] of Object.entries(state)) {
        const p = presences[0] as Record<string, unknown> | undefined;
        if (p && typeof p.userId === "string") {
          users.push({
            userId: p.userId as string,
            displayName: (p.displayName as string) || "Unknown",
            avatarUrl: (p.avatarUrl as string) || null,
            color: getUserColor(p.userId as string),
            joinedAt: (p.joinedAt as number) || Date.now(),
          });
        }
      }

      this.onPresence?.(users);
    });

    // Subscribe and track presence
    this.channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await this.channel?.track({
          userId: this.userId,
          displayName: this.displayName,
          avatarUrl: this.avatarUrl,
          color: getUserColor(this.userId),
          joinedAt: Date.now(),
        });
      }

      if (status === "CHANNEL_ERROR") {
        this.scheduleReconnect();
      }
    });
  }

  broadcast(op: Omit<RealtimeOperation, "userId" | "timestamp">) {
    if (!this.channel) return;
    this.channel.send({
      type: "broadcast",
      event: "operation",
      payload: {
        ...op,
        userId: this.userId,
        timestamp: Date.now(),
      },
    });
  }

  leave() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.projectId = null;
    this.onOperation = null;
    this.onPresence = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.projectId && this.onOperation && this.onPresence) {
        this.join(this.projectId, this.onOperation, this.onPresence);
      }
    }, 3000);
  }

  get isConnected(): boolean {
    return this.channel !== null;
  }

  get currentProjectId(): string | null {
    return this.projectId;
  }
}
