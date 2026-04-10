/**
 * User Profile Store
 *
 * Dades de perfil visible: avatar, nickname i bio.
 * - avatar i bio: persistits a la BD via useUserPrefsStore (font de veritat)
 * - nickname: en memòria, hidratat des de la sessió (firstName + lastName)
 *
 * No usa localStorage persist — la BD és la font de veritat per a avatar i bio.
 */

import { create } from 'zustand';
import { useUserPrefsStore } from '@/lib/store/user-prefs';

/** Predefined avatar options */
export const AVATAR_OPTIONS = [
  '/avatars/user.png',
  '/avatars/teacher-2.png',
  '/avatars/assist-2.png',
  '/avatars/clown-2.png',
  '/avatars/curious-2.png',
  '/avatars/note-taker-2.png',
  '/avatars/thinker-2.png',
] as const;

export interface UserProfileState {
  avatar: string;
  nickname: string;
  bio: string;
  /** Canvia l'avatar i el desa a la BD (per a accions de l'usuari) */
  setAvatar: (avatar: string) => void;
  setNickname: (nickname: string) => void;
  /** Canvia la bio i la desa a la BD (per a accions de l'usuari) */
  setBio: (bio: string) => void;
  /** Hidrata avatar+bio des de la BD sense reescriure (usa'l a la càrrega inicial) */
  hydrateProfile: (avatar: string, bio: string) => void;
}

export const useUserProfileStore = create<UserProfileState>()((set) => ({
  avatar: AVATAR_OPTIONS[0],
  nickname: '',
  bio: '',

  setAvatar: (avatar) => {
    set({ avatar });
    useUserPrefsStore.getState().setAvatar(avatar);
  },

  setNickname: (nickname) => set({ nickname }),

  setBio: (bio) => {
    set({ bio });
    useUserPrefsStore.getState().setBio(bio);
  },

  hydrateProfile: (avatar, bio) => set({ avatar, bio }),
}));
