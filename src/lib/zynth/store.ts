"use client";

import { create } from "zustand";

export interface PublicMedia {
  id: string;
  type: string;
  title: string | null;
  prompt: string | null;
  provider: string | null;
  status: string;
  mimeType: string | null;
  size: number | null;
  error: string | null;
  url: string | null;
  createdAt: string;
  updatedAt: string;
  meta: Record<string, unknown> | null;
}

export interface FeatureFlags {
  imageProvider: "openai" | "zai";
  imageModel: string;
  videoProvider: string | null;
  videoModel: string;
  metricool: boolean;
  gptAuth: boolean;
  turso: boolean;
}

interface ZynthState {
  media: PublicMedia[];
  processing: number;
  loading: boolean;
  loaded: boolean;
  selectedIds: string[];
  features: FeatureFlags | null;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  removeMedia: (id: string) => void;
}

export const useZynthStore = create<ZynthState>((set, get) => ({
  media: [],
  processing: 0,
  loading: false,
  loaded: false,
  selectedIds: [],
  features: null,

  refresh: async (opts) => {
    if (!opts?.silent) set({ loading: true });
    try {
      const [mediaRes, healthRes] = await Promise.all([
        fetch(`/api/media?refresh=1&limit=60`, { cache: "no-store" }),
        fetch(`/api/health`, { cache: "no-store" }),
      ]);
      const mediaJson = (await mediaRes.json()) as {
        media: PublicMedia[];
        processing: number;
      };
      const healthJson = (await healthRes.json()) as {
        features: FeatureFlags;
      };
      set({
        media: mediaJson.media ?? [],
        processing: mediaJson.processing ?? 0,
        features: healthJson.features ?? null,
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  toggleSelect: (id) => {
    const current = get().selectedIds;
    set({
      selectedIds: current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id].slice(0, 9),
    });
  },

  clearSelection: () => set({ selectedIds: [] }),

  removeMedia: (id) => {
    set({
      media: get().media.filter((m) => m.id !== id),
      selectedIds: get().selectedIds.filter((x) => x !== id),
    });
  },
}));
