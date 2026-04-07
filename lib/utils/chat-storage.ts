/**
 * Chat Storage - Server mode: chats are embedded in stage JSON via
 * saveStageData/loadStageData, so these functions are no-ops.
 */

import type { ChatSession } from '@/lib/types/chat';

/** Chats are saved as part of StageStoreData — no-op. */
export async function saveChatSessions(_stageId: string, _sessions: ChatSession[]): Promise<void> {}

/** Chats are returned as part of StageStoreData — returns empty array. */
export async function loadChatSessions(_stageId: string): Promise<ChatSession[]> {
  return [];
}

/** Handled by deleteStageData (deletes the whole stage) — no-op. */
export async function deleteChatSessions(_stageId: string): Promise<void> {}
