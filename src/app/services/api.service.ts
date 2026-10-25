import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Note, Task, NoteProcessingResponse, PaginatedResponse,
  HealthResponse, TaskStatus, TaskPriority
} from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ===== Health =====
  getHealth(): Observable<HealthResponse> {
    // Health endpoint is at root, not under /api
    const healthUrl = this.baseUrl.replace('/api', '') + '/health';
    return this.http.get<HealthResponse>(healthUrl);
  }

  // ===== Voice =====
  transcribeAudio(audioBlob: Blob, filename: string = 'recording.webm'): Observable<NoteProcessingResponse> {
    const formData = new FormData();
    formData.append('audio', audioBlob, filename);
    return this.http.post<NoteProcessingResponse>(`${this.baseUrl}/voice/transcribe`, formData);
  }

  // ===== Notes =====
  createTextNote(text: string): Observable<NoteProcessingResponse> {
    return this.http.post<NoteProcessingResponse>(`${this.baseUrl}/notes`, { text });
  }

  getNotes(params?: {
    source?: string;
    page?: number;
    created_at__gte?: string;
    created_at__lte?: string;
  }): Observable<PaginatedResponse<Note>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }
    return this.http.get<PaginatedResponse<Note>>(`${this.baseUrl}/notes/`, { params: httpParams });
  }

  getNote(id: string): Observable<Note> {
    return this.http.get<Note>(`${this.baseUrl}/notes/${id}/`);
  }

  // ===== Tasks =====
  getTasks(params?: {
    status?: TaskStatus;
    priority?: TaskPriority;
    due_date__gte?: string;
    due_date__lte?: string;
    page?: number;
    ordering?: string;
    search?: string;
  }): Observable<PaginatedResponse<Task>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }
    return this.http.get<PaginatedResponse<Task>>(`${this.baseUrl}/tasks/`, { params: httpParams });
  }

  getTask(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.baseUrl}/tasks/${id}/`);
  }

  updateTask(id: string, data: Partial<Task>): Observable<Task> {
    return this.http.patch<Task>(`${this.baseUrl}/tasks/${id}/`, data);
  }

  deleteTask(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/tasks/${id}/`);
  }

  createTask(data: Partial<Task>): Observable<Task> {
    return this.http.post<Task>(`${this.baseUrl}/tasks/`, data);
  }
}
