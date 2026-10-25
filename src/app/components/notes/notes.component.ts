import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';

import { ApiService } from '../../services/api.service';
import { Note } from '../../models/interfaces';

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './notes.component.html',
  styleUrls: ['./notes.component.css']
})
export class NotesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  notes: Note[] = [];
  totalCount = 0;
  currentPage = 1;
  isLoading = false;
  sourceFilter = '';
  selectedNote: Note | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadNotes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadNotes(): void {
    this.isLoading = true;
    const params: any = { page: this.currentPage };
    if (this.sourceFilter) params.source = this.sourceFilter;

    this.api.getNotes(params)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false),
      )
      .subscribe({
        next: (res) => {
          this.notes = res.results;
          this.totalCount = res.count;
        },
        error: () => {},
      });
  }

  applyFilter(): void {
    this.currentPage = 1;
    this.loadNotes();
  }

  selectNote(note: Note): void {
    if (this.selectedNote?.id === note.id) {
      this.selectedNote = null;
      return;
    }
    this.api.getNote(note.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (full) => this.selectedNote = full,
        error: () => this.selectedNote = note,
      });
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount / 20);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadNotes();
  }

  timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
}
