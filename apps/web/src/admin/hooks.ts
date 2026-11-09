import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage, setCsrfToken } from '../lib/api';

export interface Me {
  username: string;
  csrfToken: string;
  publicUrl: string;
}

export function useMe() {
  return useQuery({
    queryKey: ['admin', 'me'],
    queryFn: async () => {
      const me = await api<Me>('/api/admin/auth/me');
      setCsrfToken(me.csrfToken);
      return me;
    },
    retry: false,
    staleTime: Infinity,
  });
}

export function useAdminQuery<T>(key: string, path: string) {
  return useQuery({ queryKey: ['admin', key], queryFn: () => api<T>(path) });
}

/** Mutation that toasts on success/failure and refreshes the given admin query keys. */
export function useAdminMutation<V, R = unknown>(
  fn: (v: V) => Promise<R>,
  opts: { invalidate?: string[]; success?: string | ((r: R) => string) } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      for (const k of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: ['admin', k] as QueryKey });
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export const inviteLink = (publicUrl: string, code: string) => `${publicUrl.replace(/\/$/, '')}/?g=${code}`;

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
