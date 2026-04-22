"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerActions = void 0;
const telegraf_1 = require("telegraf");
const yamlAdmin_1 = require("../service/yamlAdmin");
const logger_1 = require("../utils/logger");
const cleanup_1 = require("../utils/cleanup");
const registerActions = (bot) => {
    bot.action('action_add_section', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.scene.enter('ADD_SECTION_SCENE');
    });
    bot.action('action_manage_sections', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.scene.enter('MANAGE_SECTION_SCENE');
    });
    bot.action('action_add_item', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.scene.enter('ADD_ITEM_SCENE');
    });
    bot.action('action_edit_item', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.scene.enter('EDIT_ITEM_SCENE');
    });
    bot.action('action_move_item', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.scene.enter('MOVE_ITEM_SCENE');
    });
    bot.action('action_manage_navlinks', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.scene.enter('MANAGE_NAVLINKS_SCENE');
    });
    bot.action('action_manage_sublinks', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.scene.enter('MANAGE_SUBITEMS_SCENE');
    });
    bot.action('action_delete_item', async (ctx) => {
        await ctx.answerCbQuery();
        const sections = yamlAdmin_1.yamlAdmin.getSections();
        if (!sections.length)
            return ctx.reply('No sections/items found.');
        const buttons = [];
        sections.forEach((s) => {
            s.items?.forEach((i) => {
                const cbData = `del_${i.id}`;
                buttons.push([telegraf_1.Markup.button.callback(`🗑️ ${i.title} (${s.name})`, cbData)]);
            });
        });
        if (buttons.length === 0)
            return ctx.reply('No items to delete.');
        await (0, cleanup_1.cleanupBotMessages)(ctx);
        await ctx.reply('Select an item to delete:', telegraf_1.Markup.inlineKeyboard(buttons));
    });
    bot.action(/del_(.+)/, async (ctx) => {
        try {
            if (!ctx.match)
                return;
            const itemId = ctx.match[1];
            const itemInfo = yamlAdmin_1.yamlAdmin.getItemById(itemId);
            if (!itemInfo) {
                await ctx.answerCbQuery('Item not found.', { show_alert: true });
                return;
            }
            const { section, item } = itemInfo;
            const success = yamlAdmin_1.yamlAdmin.deleteItemById(itemId);
            await (0, cleanup_1.cleanupBotMessages)(ctx);
            if (success) {
                await ctx.answerCbQuery('Item deleted successfully!');
                await ctx.editMessageText(`✅ Deleted "${item.title}" from "${section.name}"`);
            }
            else {
                await ctx.answerCbQuery('Failed to delete item.', { show_alert: true });
                await ctx.editMessageText(`❌ Failed to delete "${item.title}". It may not exist.`);
            }
        }
        catch (e) {
            logger_1.logger.error({ err: e }, 'Error in delete action');
        }
    });
};
exports.registerActions = registerActions;
// codded by https://github.com/dominatos
