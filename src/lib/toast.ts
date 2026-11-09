/**
 * Tiny global toast store. Call `toast.success(...)` / `toast.error(...)` from anywhere
 * (screens, thunks, helpers); <Toaster /> in the root layout renders them from the top.
 */

export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
};

type Listener = (toasts: ToastItem[]) => void;

const MAX_VISIBLE = 3;
const DEFAULT_DURATION: Record<ToastType, number> = { success: 3000, info: 3500, error: 4500 };

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(toasts));
}

function show(type: ToastType, title: string, message?: string, duration = DEFAULT_DURATION[type]) {
  // Skip an identical toast that's already showing (e.g. a double tap).
  if (toasts.some((t) => t.type === type && t.title === title && t.message === message)) return;
  const item: ToastItem = { id: nextId++, type, title, message, duration };
  toasts = [...toasts, item].slice(-MAX_VISIBLE);
  emit();
  return item.id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export const toast = {
  success: (title: string, message?: string) => show('success', title, message),
  error: (title: string, message?: string) => show('error', title, message),
  info: (title: string, message?: string) => show('info', title, message),
};

/** The backend's error message (axios `response.data.message`), or a fallback. */
export function getErrorMessage(error: any, fallback = 'Something went wrong. Please try again.'): string {
  const data = error?.response?.data ?? error;
  const message =
    (typeof data === 'string' && data) ||
    data?.message ||
    data?.error ||
    (Array.isArray(data?.errorSources) && data.errorSources[0]?.message) ||
    (error?.message !== 'Network Error' ? undefined : 'No internet connection.');
  return typeof message === 'string' && message.trim() ? message : fallback;
}

/** Shows an error toast with the backend's message. */
export function toastError(error: any, title = 'Something went wrong') {
  toast.error(title, getErrorMessage(error, 'Please try again.'));
}
