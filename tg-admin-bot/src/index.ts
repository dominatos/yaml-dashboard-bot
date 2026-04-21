import { Telegraf, session, Markup } from 'telegraf';
import { version } from '../package.json';
import { env } from './config';
import { logger } from './utils/logger';
import { authMiddleware } from './bot/middleware';
import { registerCommands } from './bot/commands';
import { registerActions } from './bot/actions';
import { stage } from './bot/scenes';
import { cleanupBotMessages } from './utils/cleanup';

const bot = new Telegraf(env.BOT_TOKEN);

// Scene-entry action IDs that trigger a new wizard/flow
const SCENE_ENTRY_ACTIONS = [
  'action_add_section',
  'action_manage_sections',
  'action_add_item',
  'action_edit_item',
  'action_move_item',
  'action_delete_item',
];

// Slash commands that enter a scene
const SCENE_ENTRY_COMMANDS: Record<string, string> = {
  '/add': 'action_add_item',
  '/edit': 'action_edit_item',
  '/add_section': 'action_add_section',
  '/manage_sections': 'action_manage_sections',
  '/delete': 'action_delete_item',
};

// Apply middlewares
bot.use(session());
bot.use(authMiddleware);

// ── Message tracking middleware (runs BEFORE everything) ──
bot.use(async (ctx, next) => {
  const session = (ctx as any).session;
  if (!session) return next();
  if (!session.__botMessages) session.__botMessages = [];

  const originalReply = ctx.reply.bind(ctx);
  ctx.reply = async (text: any, extra?: any) => {
    const msg = await originalReply(text, extra);
    if (msg && msg.message_id) session.__botMessages.push(msg.message_id);
    return msg;
  };

  const originalReplyWithMarkdown = ctx.replyWithMarkdown.bind(ctx);
  ctx.replyWithMarkdown = async (markdown: string, extra?: any) => {
    const msg = await originalReplyWithMarkdown(markdown, extra);
    if (msg && msg.message_id) session.__botMessages.push(msg.message_id);
    return msg;
  };

  return next();
});

// ── Scene guard middleware (runs BEFORE stage) ──
// Intercepts /cancel, scene-entry actions, and scene-entry commands
// when a wizard is already active. Prompts user to confirm cancellation.
bot.use(async (ctx, next) => {
  const session = (ctx as any).session;
  if (!session) return next();

  const activeScene = session.__scenes?.current;

  // --- Handle /cancel command (existing behavior) ---
  if (ctx.message && 'text' in ctx.message && ctx.message.text === '/cancel') {
    await cleanupBotMessages(ctx);
    if (session.__scenes) delete session.__scenes;
    if (session.__pendingAction) delete session.__pendingAction;
    if (session.__pendingCommand) delete session.__pendingCommand;
    await ctx.reply('Any active operation has been cancelled.');
    return;
  }

  // --- Handle cancel confirmation/denial callbacks (always, even outside scene) ---
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = ctx.callbackQuery.data;

    if (data === 'confirm_cancel_scene') {
      const pendingAction = session.__pendingAction;
      const pendingCommand = session.__pendingCommand;
      await cleanupBotMessages(ctx);
      delete session.__scenes;       // leave the current scene
      // Delete the confirmation prompt message
      try { await ctx.deleteMessage(); } catch (_) {}
      // Keep pending* so the post-stage handler can enter the new scene / run the command
      if (!pendingAction && !pendingCommand) {
        delete session.__pendingAction;
        delete session.__pendingCommand;
        await ctx.answerCbQuery();
        await ctx.reply('Previous operation cancelled.');
        return;
      }
      await ctx.answerCbQuery();
      return next(); // pass through to stage (no scene now) → post-stage handler picks up
    }

    if (data === 'deny_cancel_scene') {
      delete session.__pendingAction;
      delete session.__pendingCommand;
      await ctx.answerCbQuery();
      // Delete the confirmation prompt instead of adding a new message
      try { await ctx.deleteMessage(); } catch (_) {}
      return;
    }
  }

  // Everything below only matters if a scene is active
  if (!activeScene) return next();

  // --- Intercept scene-entry callback actions while in a scene ---
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    const data = ctx.callbackQuery.data;

    if (SCENE_ENTRY_ACTIONS.includes(data)) {
      session.__pendingAction = data;
      await ctx.answerCbQuery();
      await ctx.reply(
        '⚠️ You have an active operation in progress. Cancel it and start a new one?',
        Markup.inlineKeyboard([
          [Markup.button.callback('Yes, cancel', 'confirm_cancel_scene')],
          [Markup.button.callback('No, go back', 'deny_cancel_scene')],
        ])
      );
      return;
    }
  }

  // --- Intercept ANY slash command while in a scene ---
  if (ctx.message && 'text' in ctx.message) {
    const text = (ctx.message as any).text.trim();
    if (text.startsWith('/') && text !== '/cancel') {
      // For scene-entry commands, store the action so we auto-enter after cancel
      if (SCENE_ENTRY_COMMANDS[text]) {
        session.__pendingAction = SCENE_ENTRY_COMMANDS[text];
      } else {
        // For non-scene commands (/items, /sections, /help, etc.), store the raw command
        session.__pendingCommand = text;
      }
      await ctx.reply(
        '⚠️ You have an active operation in progress. Cancel it and start a new one?',
        Markup.inlineKeyboard([
          [Markup.button.callback('Yes, cancel', 'confirm_cancel_scene')],
          [Markup.button.callback('No, go back', 'deny_cancel_scene')],
        ])
      );
      return;
    }
  }

  return next();
});

bot.use(stage.middleware());

// ── Post-stage handler: enter pending scene/command after cancellation ──
bot.use(async (ctx, next) => {
  const session = (ctx as any).session;
  const pendingAction = session?.__pendingAction;
  const pendingCommand = session?.__pendingCommand;
  if (!pendingAction && !pendingCommand) return next();

  delete session.__pendingAction;
  delete session.__pendingCommand;

  // --- Handle scene-entry actions ---
  if (pendingAction) {
    const ACTION_TO_SCENE: Record<string, string> = {
      'action_add_section': 'ADD_SECTION_SCENE',
      'action_manage_sections': 'MANAGE_SECTION_SCENE',
      'action_add_item': 'ADD_ITEM_SCENE',
      'action_edit_item': 'EDIT_ITEM_SCENE',
      'action_move_item': 'MOVE_ITEM_SCENE',
    };

    const sceneName = ACTION_TO_SCENE[pendingAction];
    if (sceneName) {
      await ctx.reply('Previous operation cancelled.');
      await (ctx as any).scene.enter(sceneName);
      return;
    }

    // action_delete_item is not a scene — re-trigger the delete-item list
    if (pendingAction === 'action_delete_item') {
      const { yamlAdmin } = await import('./service/yamlAdmin');
      await ctx.reply('Previous operation cancelled.');
      const sections = yamlAdmin.getSections();
      const buttons: any[] = [];
      sections.forEach((s) => {
        s.items?.forEach((i) => {
          buttons.push([Markup.button.callback(`🗑️ ${i.title} (${s.name})`, `del_${i.id}`)]);
        });
      });
      if (buttons.length === 0) {
        await ctx.reply('No items to delete.');
      } else {
        await ctx.reply('Select an item to delete:', Markup.inlineKeyboard(buttons));
      }
      return;
    }
  }

  // --- Handle non-scene commands (/items, /sections, /help, /start) ---
  if (pendingCommand) {
    await ctx.reply('Previous operation cancelled. Please re-send your command:');
    await ctx.reply(`Tip: type ${pendingCommand} again.`);
    return;
  }

  return next();
});

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
(async () => {
  try {
    await bot.launch();
    logger.info(`🤖 Telegram Admin Bot v${version} started successfully in polling mode.`);
    
    // Register commands for the native bot Menu
    await bot.telegram.setMyCommands([
      { command: 'sections', description: 'List all sections' },
      { command: 'items', description: 'List all items' },
      { command: 'add', description: 'Add a new item' },
      { command: 'delete', description: 'Delete an item' },
      { command: 'edit', description: 'Edit an item' },
      { command: 'add_section', description: 'Create a new section' },
      { command: 'manage_sections', description: 'Rename, Move items, or Delete Sections' },
      { command: 'cancel', description: 'Cancel any current operation' }
    ]);
  } catch (err) {
    logger.fatal({ err }, 'Failed to start bot');
    process.exit(1);
  }
})();

// Enable graceful stop
process.once('SIGINT', () => stopProcess('SIGINT'));
process.once('SIGTERM', () => stopProcess('SIGTERM'));

// codded by https://github.com/dominatos
