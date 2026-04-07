/**
 * Layout Store
 *
 * Preferències d'UI efímeres (sidebar, chat area, playback).
 * Persisted a localStorage — no val la pena guardar a BD.
 * Separades del useSettingsStore per deixar-lo lliure de persist.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlaybackSpeed } from '@/lib/store/settings';

export interface LayoutState {
  // Playback controls
  ttsMuted: boolean;
  ttsVolume: number;
  autoPlayLecture: boolean;
  playbackSpeed: PlaybackSpeed;

  // Layout preferences
  sidebarCollapsed: boolean;
  chatAreaCollapsed: boolean;
  chatAreaWidth: number;

  // Actions
  setTTSMuted: (muted: boolean) => void;
  setTTSVolume: (volume: number) => void;
  setAutoPlayLecture: (autoPlay: boolean) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setChatAreaCollapsed: (collapsed: boolean) => void;
  setChatAreaWidth: (width: number) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      ttsMuted: false,
      ttsVolume: 1,
      autoPlayLecture: false,
      playbackSpeed: 1,
      sidebarCollapsed: true,
      chatAreaCollapsed: true,
      chatAreaWidth: 320,

      setTTSMuted: (ttsMuted) => set({ ttsMuted }),
      setTTSVolume: (ttsVolume) => set({ ttsVolume }),
      setAutoPlayLecture: (autoPlayLecture) => set({ autoPlayLecture }),
      setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setChatAreaCollapsed: (chatAreaCollapsed) => set({ chatAreaCollapsed }),
      setChatAreaWidth: (chatAreaWidth) => set({ chatAreaWidth }),
    }),
    { name: 'layout-storage' },
  ),
);
