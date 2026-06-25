import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api } from "./api";
import type { ConfigPatch, Entry, Settings } from "./types";

export const keys = {
  health: ["health"] as const,
  day: (date: string) => ["day", date] as const,
  settings: ["settings"] as const,
  history: (days: number) => ["history", days] as const,
  config: ["config"] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: keys.health,
    queryFn: api.health,
    staleTime: 30_000,
  });
}

export function useConfig() {
  return useQuery({
    queryKey: keys.config,
    queryFn: api.getConfig,
    staleTime: 30_000,
  });
}

export function usePutConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ConfigPatch) => api.putConfig(patch),
    onSuccess: (data) => {
      qc.setQueryData(keys.config, data);
      qc.invalidateQueries({ queryKey: keys.health });
    },
  });
}

export function useDay(date: string) {
  return useQuery({
    queryKey: keys.day(date),
    queryFn: () => api.day(date),
  });
}

export function useHistory(days: number) {
  return useQuery({
    queryKey: keys.history(days),
    queryFn: () => api.history(days),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: api.getSettings,
  });
}

// Invalidate everything that depends on a day's entries.
function invalidateEntryViews(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["day"] });
  qc.invalidateQueries({ queryKey: ["history"] });
}

export function useSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.sync,
    onSuccess: () => invalidateEntryViews(qc),
  });
}

export function useToggle(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Entry["id"]) => api.toggle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.day(date) });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function usePatchEntry(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: Entry["id"];
      patch: Partial<
        Pick<
          Entry,
          "dish" | "notes" | "kcal" | "protein_g" | "carbs_g" | "fat_g"
        >
      >;
    }) => api.patch(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.day(date) });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function useReanalyze(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: Entry["id"]; text?: string }) =>
      api.reanalyze(id, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.day(date) });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function useChat(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: Entry["id"]; message: string }) =>
      api.chat(id, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.day(date) });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function useDeleteEntry(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Entry["id"]) => api.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.day(date) });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function usePutSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => api.putSettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(keys.settings, data);
      invalidateEntryViews(qc);
    },
  });
}
