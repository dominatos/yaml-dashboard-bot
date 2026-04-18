"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const middleware_1 = require("./bot/middleware");
const commands_1 = require("./bot/commands");
const actions_1 = require("./bot/actions");
const scenes_1 = require("./bot/scenes");
const bot = new telegraf_1.Telegraf(config_1.env.BOT_TOKEN);
// Apply middlewares
bot.use((0, telegraf_1.session)());
bot.use(middleware_1.authMiddleware);
// Intercept /cancel before scene middleware to forcefully abort any wizard step
bot.use(async (ctx, next) => {
    if (ctx.message && 'text' in ctx.message && ctx.message.text === '/cancel') {
        if (ctx.session && ctx.session.__scenes) {
            delete ctx.session.__scenes;
        }
        await ctx.reply('Any active operation has been cancelled.');
        return;
    }
    return next();
});
bot.use(scenes_1.stage.middleware());
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
bot.launch(() => {
    logger_1.logger.info(`🤖 Telegram Admin Bot started successfully in polling mode.`);
    // Register commands for the native bot Menu
    bot.telegram.setMyCommands([
        { command: 'sections', description: 'List all sections' },
        { command: 'items', description: 'List all items' },
        { command: 'add', description: 'Add a new item' },
        { command: 'delete', description: 'Delete an item' },
        { command: 'edit', description: 'Edit an item' },
        { command: 'add_section', description: 'Create a new section' },
        { command: 'manage_sections', description: 'Rename, Move items, or Delete Sections' },
        { command: 'cancel', description: 'Cancel any current operation' }
    ]).catch(err => logger_1.logger.error({ err }, 'Failed to set commands menu'));
}).catch((err) => {
    logger_1.logger.fatal({ err }, 'Failed to start bot');
    process.exit(1);
});
// Enable graceful stop
process.once('SIGINT', () => stopProcess('SIGINT'));
process.once('SIGTERM', () => stopProcess('SIGTERM'));
// codded by https://github.com/dominatos
