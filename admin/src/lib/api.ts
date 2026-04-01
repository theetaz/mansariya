import axios from 'axios';

type ApiErrorPayload = {
  error?: string | {
    code?: string;
    message?: string;
    field?: string;
  };
  message?: string;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey && config.url?.includes('/admin')) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

export function getApiError(error: unknown): { code?: string; message: string; field?: string; status?: number } {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const data = error.response?.data;
    const status = error.response?.status;

    if (typeof data?.error === 'string') {
      return { message: data.error, status };
    }

    if (data?.error?.message) {
      return {
        code: data.error.code,
        message: data.error.message,
        field: data.error.field,
        status,
      };
    }

    if (typeof data?.message === 'string' && data.message.length > 0) {
      return { message: data.message, status };
    }

    if (typeof error.message === 'string' && error.message.length > 0) {
      return { message: error.message, status };
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return { message: error.message };
  }

  return { message: 'Something went wrong. Please try again.' };
}

export default api;
