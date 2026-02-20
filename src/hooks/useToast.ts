import { useCallback } from 'react';
import { toastService } from '../services/toast.service';
import { ToastOptions } from '../types/toast.types';

export function useToast() {
  const success = useCallback((message: string, options?: ToastOptions) => {
    return toastService.success(message, options);
  }, []);

  const error = useCallback((message: string, options?: ToastOptions) => {
    return toastService.error(message, options);
  }, []);

  const warning = useCallback((message: string, options?: ToastOptions) => {
    return toastService.warning(message, options);
  }, []);

  const info = useCallback((message: string, options?: ToastOptions) => {
    return toastService.info(message, options);
  }, []);

  const dismiss = useCallback((id: string) => {
    toastService.dismiss(id);
  }, []);

  const dismissAll = useCallback(() => {
    toastService.dismissAll();
  }, []);

  return {
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll
  };
}
