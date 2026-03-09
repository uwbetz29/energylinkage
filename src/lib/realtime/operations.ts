export type OperationType =
  | "scale_component"
  | "add_drawing"
  | "remove_drawing"
  | "rename_project"
  | "update_project_data"
  | "cursor_move";

export interface RealtimeOperation {
  type: OperationType;
  userId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface CursorPosition {
  userId: string;
  displayName: string;
  x: number;
  y: number;
  color: string;
}

export interface PresenceState {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  joinedAt: number;
}

// Generate a consistent color from user ID
const PRESENCE_COLORS = [
  "#93C90F", "#00BFDD", "#E05A2A", "#7A2FC9",
  "#F59E0B", "#EC4899", "#14B8A6", "#8B5CF6",
];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

export function validateOperation(op: unknown): op is RealtimeOperation {
  if (!op || typeof op !== "object") return false;
  const o = op as Record<string, unknown>;
  return (
    typeof o.type === "string" &&
    typeof o.userId === "string" &&
    typeof o.timestamp === "number" &&
    typeof o.payload === "object" &&
    o.payload !== null
  );
}
