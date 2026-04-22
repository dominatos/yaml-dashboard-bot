"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const package_json_1 = require("../package.json");
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const middleware_1 = require("./bot/middleware");
const commands_1 = require("./bot/commands");
const actions_1 = require("./bot/actions");
const scenes_1 = require("./bot/scenes");
const cleanup_1 = require("./utils/cleanup");
const bot = new telegraf_1.Telegraf(config_1.env.BOT_TOKEN);
// Scene-entry action IDs that trigger a new wizard/flow
const SCENE_ENTRY_ACTIONS = [
    'action_add_section',
    'action_manage_sections',
    'action_add_item',
    'action_edit_item',
    'action_move_item',
    'action_manage_navlinks',
    'action_manage_sublinks',
    'action_delete_item',
];
// Slash commands that enter a scene
const SCENE_ENTRY_COMMANDS = {
    '/add': 'action_add_item',
    '/edit': 'action_edit_item',
    '/add_section': 'action_add_section',
    '/manage_sections': 'action_manage_sections',
    '/navlinks': 'action_manage_navlinks',
    '/sublinks': 'action_manage_sublinks',
    '/delete': 'action_delete_item',
};
// Commands handled by active wizard steps and should not trigger cancel flow
const SCENE_INTERNAL_COMMANDS = new Set(['/skip', '/back']);
// Apply middlewares
bot.use((0, telegraf_1.session)());
bot.use(middleware_1.authMiddleware);
// ── Message tracking middleware (runs BEFORE everything) ──
bot.use(async (ctx, next) => {
    const session = ctx.session;
    if (!session)
        return next();
    if (!session.__botMessages)
        session.__botMessages = [];
    const originalReply = ctx.reply.bind(ctx);
    ctx.reply = async (text, extra) => {
        const msg = await originalReply(text, extra);
        if (msg && msg.message_id)
            session.__botMessages.push(msg.message_id);
        return msg;
    };
    const originalReplyWithMarkdown = ctx.replyWithMarkdown.bind(ctx);
    ctx.replyWithMarkdown = async (markdown, extra) => {
        const msg = await originalReplyWithMarkdown(markdown, extra);
        if (msg && msg.message_id)
            session.__botMessages.push(msg.message_id);
        return msg;
    };
    return next();
});
// ── Scene guard middleware (runs BEFORE stage) ──
// Intercepts /cancel, scene-entry actions, and scene-entry commands
// when a wizard is already active. Prompts user to confirm cancellation.
bot.use(async (ctx, next) => {
    const session = ctx.session;
    if (!session)
        return next();
    const activeScene = session.__scenes?.current;
    // --- Handle /cancel command (existing behavior) ---
    if (ctx.message && 'text' in ctx.message && ctx.message.text === '/cancel') {
        await (0, cleanup_1.cleanupBotMessages)(ctx);
        if (session.__scenes)
            delete session.__scenes;
        if (session.__pendingAction)
            delete session.__pendingAction;
        if (session.__pendingCommand)
            delete session.__pendingCommand;
        await (0, commands_1.sendMainMenu)(ctx, 'Any active operation has been cancelled.');
        return;
    }
    // --- Handle cancel confirmation/denial callbacks (always, even outside scene) ---
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (data === 'confirm_cancel_scene') {
            const pendingAction = session.__pendingAction;
            const pendingCommand = session.__pendingCommand;
            await (0, cleanup_1.cleanupBotMessages)(ctx);
            delete session.__scenes; // leave the current scene
            // Delete the confirmation prompt message
            try {
                await ctx.deleteMessage();
            }
            catch (_) { }
            // Keep pending* so the post-stage handler can enter the new scene / run the command
            if (!pendingAction && !pendingCommand) {
                delete session.__pendingAction;
                delete session.__pendingCommand;
                await ctx.answerCbQuery();
                await (0, commands_1.sendMainMenu)(ctx, 'Previous operation cancelled.');
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
            try {
                await ctx.deleteMessage();
            }
            catch (_) { }
            await ctx.reply('🔄 Resumed previous operation. Please provide your input:');
            return;
        }
    }
    // Everything below only matters if a scene is active
    if (!activeScene)
        return next();
    // --- Intercept scene-entry callback actions while in a scene ---
    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (SCENE_ENTRY_ACTIONS.includes(data)) {
            session.__pendingAction = data;
            await ctx.answerCbQuery();
            await ctx.reply('⚠️ You have an active operation in progress. Cancel it and start a new one?', telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('Yes, cancel', 'confirm_cancel_scene')],
                [telegraf_1.Markup.button.callback('No, go back', 'deny_cancel_scene')],
            ]));
            return;
        }
    }
    // --- Intercept ANY slash command while in a scene ---
    if (ctx.message && 'text' in ctx.message) {
        const rawText = ctx.message.text.trim();
        const command = rawText.split('@')[0].toLowerCase();
        if (command.startsWith('/') && command !== '/cancel' && !SCENE_INTERNAL_COMMANDS.has(command)) {
            // For scene-entry commands, store the action so we auto-enter after cancel
            if (SCENE_ENTRY_COMMANDS[command]) {
                session.__pendingAction = SCENE_ENTRY_COMMANDS[command];
            }
            else {
                // For non-scene commands (/items, /sections, /help, etc.), store the raw command
                session.__pendingCommand = rawText;
            }
            await ctx.reply('⚠️ You have an active operation in progress. Cancel it and start a new one?', telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('Yes, cancel', 'confirm_cancel_scene')],
                [telegraf_1.Markup.button.callback('No, go back', 'deny_cancel_scene')],
            ]));
            return;
        }
    }
    return next();
});
bot.use(scenes_1.stage.middleware());
// ── Post-stage handler: enter pending scene/command after cancellation ──
bot.use(async (ctx, next) => {
    const session = ctx.session;
    const pendingAction = session?.__pendingAction;
    const pendingCommand = session?.__pendingCommand;
    if (!pendingAction && !pendingCommand)
        return next();
    delete session.__pendingAction;
    delete session.__pendingCommand;
    // --- Handle scene-entry actions ---
    if (pendingAction) {
        const ACTION_TO_SCENE = {
            'action_add_section': 'ADD_SECTION_SCENE',
            'action_manage_sections': 'MANAGE_SECTION_SCENE',
            'action_add_item': 'ADD_ITEM_SCENE',
            'action_edit_item': 'EDIT_ITEM_SCENE',
            'action_move_item': 'MOVE_ITEM_SCENE',
            'action_manage_navlinks': 'MANAGE_NAVLINKS_SCENE',
            'action_manage_sublinks': 'MANAGE_SUBITEMS_SCENE',
        };
        const sceneName = ACTION_TO_SCENE[pendingAction];
        if (sceneName) {
            await (0, commands_1.sendMainMenu)(ctx, 'Previous operation cancelled.');
            await ctx.scene.enter(sceneName);
            return;
        }
        // action_delete_item is not a scene — re-trigger the delete-item list
        if (pendingAction === 'action_delete_item') {
            const { yamlAdmin } = await Promise.resolve().then(() => __importStar(require('./service/yamlAdmin')));
            await (0, commands_1.sendMainMenu)(ctx, 'Previous operation cancelled.');
            const sections = yamlAdmin.getSections();
            const buttons = [];
            sections.forEach((s) => {
                s.items?.forEach((i) => {
                    buttons.push([telegraf_1.Markup.button.callback(`🗑️ ${i.title} (${s.name})`, `del_${i.id}`)]);
                });
            });
            if (buttons.length === 0) {
                await ctx.reply('No items to delete.');
            }
            else {
                await ctx.reply('Select an item to delete:', telegraf_1.Markup.inlineKeyboard(buttons));
            }
            return;
        }
    }
    // --- Handle non-scene commands (/items, /sections, /help, /start) ---
    if (pendingCommand) {
        await (0, commands_1.sendMainMenu)(ctx, 'Previous operation cancelled. Please choose your next action or re-send your command:');
        await ctx.reply(`Tip: type ${pendingCommand} again.`);
        return;
    }
    return next();
});
// Register functionality
(0, commands_1.registerCommands)(bot);
(0, actions_1.registerActions)(bot);
// Graceful shutdown helpers
const stopProcess = (signal) => {
    logger_1.logger.info(`Received ${signal}, stopping bot...`);
    bot.stop(signal);
    process.exit(0);
};
// Start the bot
(async () => {
    try {
        await bot.launch();
        logger_1.logger.info(`🤖 Telegram Admin Bot v${package_json_1.version} started successfully in polling mode.`);
        // Register commands for the native bot Menu
        await bot.telegram.setMyCommands([
            { command: 'sections', description: 'List all sections' },
            { command: 'items', description: 'List all items' },
            { command: 'add', description: 'Add a new item' },
            { command: 'delete', description: 'Delete an item' },
            { command: 'edit', description: 'Edit an item' },
            { command: 'add_section', description: 'Create a new section' },
            { command: 'manage_sections', description: 'Rename, Move items, or Delete Sections' },
            { command: 'navlinks', description: 'Manage top-level navigation links' },
            { command: 'sublinks', description: 'Manage sub-links within an item' },
            { command: 'cancel', description: 'Cancel any current operation' }
        ]);
    }
    catch (err) {
        logger_1.logger.fatal({ err }, 'Failed to start bot');
        process.exit(1);
    }
})();
// Enable graceful stop
process.once('SIGINT', () => stopProcess('SIGINT'));
process.once('SIGTERM', () => stopProcess('SIGTERM'));
// codded by https://github.com/dominatos
