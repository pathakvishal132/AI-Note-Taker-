import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';

import { ApiService } from '../../services/api.service';
import { AudioRecorderService, RecordingState } from '../../services/audio-recorder.service';
import {
  Task, Note, NoteProcessingResponse, TaskStats
} from '../../models/interfaces';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Stats
  stats: TaskStats = { total: 0, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };

  // Data
  recentNotes: Note[] = [];
  upcomingTasks: Task[] = [];

  // Recording state
  recordingState: RecordingState = {
    isRecording: false, isPaused: false, duration: 0,
    error: null, hasPermission: null
  };

  // Processing
  isProcessing = false;
  processingResult: NoteProcessingResponse | null = null;

  // Text input
  textInput = '';
  isSubmittingText = false;

  // Toast
  toasts: Array<{ message: string; type: 'success' | 'error' | 'info'; id: number }> = [];
  private toastId = 0;

  constructor(
    private api: ApiService,
    private audioRecorder: AudioRecorderService
  ) {}

  ngOnInit(): void {
    this.loadData();

    this.audioRecorder.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.recordingState = state;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    // Load tasks for stats
    this.api.getTasks({ ordering: 'due_date' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const all = res.results;
          this.stats = {
            total: res.count,
            pending: all.filter(t => t.status === 'PENDING').length,
            in_progress: all.filter(t => t.status === 'IN_PROGRESS').length,
            completed: all.filter(t => t.status === 'COMPLETED').length,
            cancelled: all.filter(t => t.status === 'CANCELLED').length,
          };
          this.upcomingTasks = all
            .filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
            .slice(0, 5);
        },
        error: () => this.showToast('Failed to load tasks', 'error'),
      });

    // Load recent notes
    this.api.getNotes({ page: 1 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.recentNotes = res.results.slice(0, 5);
        },
        error: () => this.showToast('Failed to load notes', 'error'),
      });
  }

  // ===== Voice Recording =====
  async startRecording(): Promise<void> {
    this.processingResult = null;
    try {
      await this.audioRecorder.startRecording();
    } catch (err: any) {
      this.showToast(err.message || 'Failed to start recording', 'error');
    }
  }

  async stopRecording(): Promise<void> {
    try {
      const audioBlob = await this.audioRecorder.stopRecording();
      this.processAudio(audioBlob);
    } catch (err: any) {
      this.showToast(err.message || 'Failed to stop recording', 'error');
    }
  }

  private processAudio(blob: Blob): void {
    this.isProcessing = true;
    this.processingResult = null;

    const ext = this.audioRecorder.getFileExtension();
    this.api.transcribeAudio(blob, `recording${ext}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isProcessing = false),
      )
      .subscribe({
        next: (result) => {
          this.processingResult = result;
          this.showToast(this.getResultMessage(result), 'success');
          this.loadData();
        },
        error: (err) => {
          const msg = err.error?.error?.message || 'Failed to process audio';
          this.showToast(msg, 'error');
        },
      });
  }

  // ===== Text Input =====
  submitTextNote(): void {
    if (!this.textInput.trim()) return;

    this.isSubmittingText = true;
    this.processingResult = null;

    this.api.createTextNote(this.textInput.trim())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSubmittingText = false),
      )
      .subscribe({
        next: (result) => {
          this.processingResult = result;
          this.textInput = '';
          this.showToast(this.getResultMessage(result), 'success');
          this.loadData();
        },
        error: (err) => {
          const msg = err.error?.error?.message || 'Failed to process text';
          this.showToast(msg, 'error');
        },
      });
  }

  // ===== Helpers =====
  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  getResultMessage(result: NoteProcessingResponse): string {
    if (!result.action) return 'Note saved';
    switch (result.action.type) {
      case 'task_created': return `Task created: ${result.action.task?.title}`;
      case 'task_updated': return `Task updated: ${result.action.task?.title}`;
      case 'tasks_queried': return `Found ${result.action.total_count} tasks`;
      case 'note_saved': return 'Note saved successfully';
      case 'needs_clarification': return result.action.message || 'Please clarify';
      default: return result.action.message || 'Processed';
    }
  }

  getStatusClass(status: string): string {
    return 'badge-' + status.toLowerCase().replace('_', '-');
  }

  getPriorityClass(priority: string): string {
    return 'badge-' + priority.toLowerCase();
  }

  getIntentLabel(intent: string | null): string {
    if (!intent) return 'Unknown';
    const labels: Record<string, string> = {
      'CREATE_TASK': '✅ Create Task',
      'UPDATE_TASK_STATUS': '🔄 Update Task',
      'QUERY_TASKS': '🔍 Query Tasks',
      'GENERAL_NOTE': '📝 General Note',
      'EXTRACTION_FAILED': '⚠️ Could not determine intent',
      'PROCESSING_ERROR': '❌ Processing error',
    };
    return labels[intent] || intent;
  }

  showToast(message: string, type: 'success' | 'error' | 'info'): void {
    const id = ++this.toastId;
    this.toasts.push({ message, type, id });
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
    }, 4000);
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
}
