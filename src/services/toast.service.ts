import { Toast, ToastOptions, ToastType, ToastListener } from '../types/toast.types';

class ToastService {
  private toasts: Toast[] = [];
  private listeners: Set<ToastListener> = new Set();
  private timers: Map<string, number> = new Map();
  private static instance: ToastService;

  private constructor() {}

  static getInstance(): ToastService {
    if (!ToastService.instance) {
      ToastService.instance = new ToastService();
    }
    return ToastService.instance;
  }

  private getDefaultDuration(type: ToastType): number {
    switch (type) {
      case 'success':
      case 'info':
      case 'warning':
        return 4000;
      case 'error':
        return 6000;
      default:
        return 4000;
    }
  }

  private notifyListeners(): void {
    const toastsCopy = [...this.toasts];
    this.listeners.forEach(listener => listener(toastsCopy));
  }

  private scheduleDismiss(toast: Toast): void {
    if (toast.options?.persistent) {
      return; // No auto-dismiss para toasts persistentes
    }

    const timer = setTimeout(() => {
      this.dismiss(toast.id);
    }, toast.duration);

    this.timers.set(toast.id, timer);
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    
    // Notificar inmediatamente con el estado actual
    listener([...this.toasts]);

    // Retornar función de unsuscribe
    return () => {
      this.listeners.delete(listener);
    };
  }

  unsubscribe(listener: ToastListener): void {
    this.listeners.delete(listener);
  }

  private addToast(type: ToastType, message: string, options?: ToastOptions): string {
    const id = crypto.randomUUID();
    const duration = options?.persistent ? 0 : this.getDefaultDuration(type);

    const toast: Toast = {
      id,
      type,
      message,
      duration,
      options
    };

    // Mantener máximo 5 toasts visibles
    if (this.toasts.length >= 5) {
      const oldestToast = this.toasts[0];
      this.clearTimer(oldestToast.id);
      this.toasts.shift();
    }

    this.toasts.push(toast);
    this.scheduleDismiss(toast);
    this.notifyListeners();

    return id;
  }

  success(message: string, options?: ToastOptions): string {
    return this.addToast('success', message, options);
  }

  error(message: string, options?: ToastOptions): string {
    return this.addToast('error', message, options);
  }

  warning(message: string, options?: ToastOptions): string {
    return this.addToast('warning', message, options);
  }

  info(message: string, options?: ToastOptions): string {
    return this.addToast('info', message, options);
  }

  dismiss(id: string): void {
    this.clearTimer(id);
    
    const index = this.toasts.findIndex(toast => toast.id === id);
    if (index !== -1) {
      this.toasts.splice(index, 1);
      this.notifyListeners();
    }
  }

  dismissAll(): void {
    // Limpiar todos los timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    // Limpiar todos los toasts
    this.toasts = [];
    this.notifyListeners();
  }
}

// Exportar instancia singleton
export const toastService = ToastService.getInstance();
