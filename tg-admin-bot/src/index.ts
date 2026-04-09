import { Telegraf, session } from 'telegraf';
import { env } from './config';
import { logger } from './utils/logger';
import { authMiddleware } from './bot/middleware';
import { registerCommands } from './bot/commands';
import { registerActions } from './bot/actions';
import { stage } from './bot/scenes';

const bot = new Telegraf(env.BOT_TOKEN);

// Apply middlewares
bot.use(session());
bot.use(authMiddleware);

// Intercept /cancel before scene middleware to forcefully abort any wizard step
bot.use(async (ctx, next) => {
  if (ctx.message && 'text' in ctx.message && ctx.message.text === '/cancel') {
    if ((ctx as any).session && (ctx as any).session.__scenes) {
      delete (ctx as any).session.__scenes;
    }
    await ctx.reply('Any active operation has been cancelled.');
    return;
  }
  return next();
});

bot.use(stage.middleware());

// Register functionality
registerCommands(bot);
registerActions(bot);

// Graceful shutdown helpers
const stopProcess = (signal: string) => {
  logger.info(`Received ${signal}, stopping bot...`);
  bot.stop(signal);
  process.exit(0);
};

// Start the bot
bot.launch(() => {
  logger.info(`🤖 Telegram Admin Bot started successfully in polling mode.`);
}).catch((err) => {
  logger.fatal({ err }, 'Failed to start bot');
  process.exit(1);
});

// Enable graceful stop
process.once('SIGINT', () => stopProcess('SIGINT'));
process.once('SIGTERM', () => stopProcess('SIGTERM'));
