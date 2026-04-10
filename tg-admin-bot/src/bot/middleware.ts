import { Context } from 'telegraf';
import { env } from '../config';
import { logger } from '../utils/logger';

export const authMiddleware = async (ctx: Context, next: () => Promise<void>) => {
  const userId = ctx.from?.id;

  if (!userId) {
    logger.warn('Received update without user ID');
    return;
  }

  if (!env.ALLOWED_USER_IDS.includes(userId)) {
    logger.warn({ userId }, 'Unauthorized access attempt');
    try {
      await ctx.reply('⛔ Unauthorized. You are not allowed to use this bot.');
    } catch (e) {
      // ignore
    }
    return;
  }

  return next();
};

// codded by https://github.com/dominatos
