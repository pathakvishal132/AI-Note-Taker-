import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';

import { ApiService } from '../../services/api.service';
import { Task, TaskStatus, TaskPriority } from '../../models/interfaces';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css']
})
export class TasksComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  tasks: Task[] = [];
  totalCount = 0;
  currentPage = 1;
  isLoading = false;

  // Filters
  statusFilter: TaskStatus | '' = '';
  priorityFilter: TaskPriority | '' = '';

  // Edit modal
  editingTask: Task | null = null;
  editForm = {
    title: '',
    description: '',
    status: '' as TaskStatus | '',
    priority: '' as TaskPriority | '',
    due_date: '',
  };
  isSaving = false;

  // Delete confirmation
  deletingTask: Task | null = null;
  isDeleting = false;

  // Toast
  toasts: Array<{ message: string; type: string; id: number }> = [];
  private toastId = 0;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadTasks();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTasks(): void {
    this.isLoading = true;
    const params: any = { page: this.currentPage };
    if (this.statusFilter) params.status = this.statusFilter;
    if (this.priorityFilter) params.priority = this.priorityFilter;

    this.api.getTasks(params)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false),
      )
      .subscribe({
        next: (res) => {
          this.tasks = res.results;
          this.totalCount = res.count;
        },
        error: () => this.showToast('Failed to load tasks', 'error'),
      });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadTasks();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.priorityFilter = '';
    this.currentPage = 1;
    this.loadTasks();
  }

  // Pagination
  get totalPages(): number {
    return Math.ceil(this.totalCount / 20);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadTasks();
  }

  // Quick status update
  quickStatusUpdate(task: Task, newStatus: TaskStatus): void {
    this.api.updateTask(task.id, { status: newStatus })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          const idx = this.tasks.findIndex(t => t.id === task.id);
          if (idx >= 0) this.tasks[idx] = updated;
          this.showToast(`Task "${task.title}" updated to ${newStatus}`, 'success');
        },
        error: () => this.showToast('Failed to update task', 'error'),
      });
  }

  // Edit
  openEdit(task: Task): void {
    this.editingTask = task;
    this.editForm = {
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
    };
  }

  cancelEdit(): void {
    this.editingTask = null;
  }

  saveEdit(): void {
    if (!this.editingTask) return;
    this.isSaving = true;

    const data: any = {};
    if (this.editForm.title !== this.editingTask.title) data.title = this.editForm.title;
    if (this.editForm.description !== this.editingTask.description) data.description = this.editForm.description;
    if (this.editForm.status !== this.editingTask.status) data.status = this.editForm.status;
    if (this.editForm.priority !== this.editingTask.priority) data.priority = this.editForm.priority;
    if (this.editForm.due_date !== (this.editingTask.due_date || '')) data.due_date = this.editForm.due_date || null;

    this.api.updateTask(this.editingTask.id, data)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSaving = false),
      )
      .subscribe({
        next: (updated) => {
          const idx = this.tasks.findIndex(t => t.id === this.editingTask!.id);
          if (idx >= 0) this.tasks[idx] = updated;
          this.editingTask = null;
          this.showToast('Task updated successfully', 'success');
        },
        error: () => this.showToast('Failed to update task', 'error'),
      });
  }

  // Delete
  confirmDelete(task: Task): void {
    this.deletingTask = task;
  }

  cancelDelete(): void {
    this.deletingTask = null;
  }

  executeDelete(): void {
    if (!this.deletingTask) return;
    this.isDeleting = true;

    this.api.deleteTask(this.deletingTask.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isDeleting = false;
          this.deletingTask = null;
        }),
      )
      .subscribe({
        next: () => {
          this.showToast('Task deleted', 'success');
          this.loadTasks();
        },
        error: () => this.showToast('Failed to delete task', 'error'),
      });
  }

  // Helpers
  getStatusClass(status: string): string {
    return 'badge-' + status.toLowerCase().replace('_', '-');
  }

  getPriorityClass(priority: string): string {
    return 'badge-' + priority.toLowerCase();
  }

  showToast(message: string, type: string): void {
    const id = ++this.toastId;
    this.toasts.push({ message, type, id });
    setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); }, 4000);
  }
}
