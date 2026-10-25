import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  error: string | null;
  hasPermission: boolean | null;
}

@Injectable({
  providedIn: 'root'
})
export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private timerInterval: any = null;
  private startTime = 0;

  private state = new BehaviorSubject<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    error: null,
    hasPermission: null,
  });

  state$ = this.state.asObservable();

  constructor(private ngZone: NgZone) {}

  async startRecording(): Promise<void> {
    try {
      this.audioChunks = [];
      this.updateState({ error: null });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.updateState({ hasPermission: true });

      // Choose a supported MIME type
      const mimeType = this.getSupportedMimeType();

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = () => {
        this.ngZone.run(() => {
          this.updateState({
            isRecording: false,
            error: 'Recording error occurred',
          });
        });
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.startTime = Date.now();
      this.startTimer();
      this.updateState({ isRecording: true, duration: 0 });

    } catch (err: any) {
      let errorMessage = 'Could not access microphone';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone permission denied. Please allow access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Microphone is in use by another application.';
      }
      this.updateState({
        isRecording: false,
        error: errorMessage,
        hasPermission: false,
      });
      throw new Error(errorMessage);
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        this.stopTimer();

        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.audioChunks = [];

        // Stop all tracks
        this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());

        this.ngZone.run(() => {
          this.updateState({ isRecording: false, duration: 0 });
        });

        if (audioBlob.size === 0) {
          reject(new Error('Recording is empty'));
          return;
        }

        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.ngZone.run(() => {
        const duration = Math.floor((Date.now() - this.startTime) / 1000);
        this.updateState({ duration });
      });
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private updateState(partial: Partial<RecordingState>): void {
    this.state.next({ ...this.state.value, ...partial });
  }

  getFileExtension(): string {
    const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
    if (mimeType.includes('webm')) return '.webm';
    if (mimeType.includes('ogg')) return '.ogg';
    if (mimeType.includes('mp4')) return '.m4a';
    return '.webm';
  }
}
