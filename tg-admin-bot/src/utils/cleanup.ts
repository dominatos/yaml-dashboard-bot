import { logger } from './logger';

/**
 * Delete all bot messages tracked in session.__botMessages.
 * Silently ignores errors (message already deleted, too old, etc.).
 */
export const cleanupBotMessages = async (ctx: any): Promise<void> => {
  const session = ctx.session;
  const messageIds: number[] = session?.__botMessages;
  if (!messageIds || messageIds.length === 0) return;

  const chatId = ctx.chat?.id;
  if (!chatId) return;

  for (const msgId of messageIds) {
    try {
      await ctx.telegram.deleteMessage(chatId, msgId);
    } catch (e) {
      // Silently ignore — message may already be deleted or too old
    }
  }

  session.__botMessages = [];
};

// codded by https://github.com/dominatos
