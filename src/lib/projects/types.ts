export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  systemType: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  drawings: ProjectDrawing[];
}

export interface ProjectDrawing {
  id: string;
  projectId: string;
  name: string;
  fileName: string;
  storagePath: string | null;
  fileSizeBytes: number | null;
  dxfContent: string | null;
  createdAt: string;
  updatedAt: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapProjectFromDB(row: any): Project {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description || "",
    systemType: row.system_type || "scr-co-catalyst",
    data: row.data || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    drawings: (row.drawings || []).map(mapDrawingFromDB),
  };
}

export function mapDrawingFromDB(row: any): ProjectDrawing {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    fileName: row.file_name,
    storagePath: row.storage_path || null,
    fileSizeBytes: row.file_size_bytes || null,
    dxfContent: row.dxf_content || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
