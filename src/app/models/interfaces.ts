/** TypeScript interfaces matching backend API contracts */

export interface Note {
  id: string;
  raw_transcript: string;
  transcript?: string;
  source: 'voice' | 'text';
  created_at: string;
  task_id?: string | null;
  task?: string | null;
  task_detail?: Task | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ActionResult {
  type: string;
  message?: string;
  task?: Task;
  tasks?: Task[];
  total_count?: number;
  matching_tasks?: Task[];
}

export interface NoteProcessingResponse {
  note: {
    id: string;
    transcript: string;
    source: 'voice' | 'text';
    created_at: string;
    task_id?: string;
  };
  intent: string | null;
  action: ActionResult | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface HealthResponse {
  status: string;
  dependencies: {
    database: string;
    stt: string;
    llm: string;
  };
}

export interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}
