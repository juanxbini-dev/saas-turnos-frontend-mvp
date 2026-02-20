export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  persistent?: boolean;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  options?: ToastOptions;
}

export interface ToastListener {
  (toasts: Toast[]): void;
}
