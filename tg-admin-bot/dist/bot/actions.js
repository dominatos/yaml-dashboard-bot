"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerActions = void 0;
const telegraf_1 = require("telegraf");
const yamlAdmin_1 = require("../service/yamlAdmin");
const logger_1 = require("../utils/logger");
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
    bot.action('action_delete_item', async (ctx) => {
        await ctx.answerCbQuery();
        const sections = yamlAdmin_1.yamlAdmin.getSections();
        if (!sections.length)
            return ctx.reply('No sections/items found.');
        const buttons = [];
        sections.forEach((s, sIndex) => {
            s.items?.forEach((i, iIndex) => {
                const cbData = `del_${sIndex}_${iIndex}`;
                buttons.push([telegraf_1.Markup.button.callback(`🗑️ ${i.title} (${s.name})`, cbData)]);
            });
        });
        if (buttons.length === 0)
            return ctx.reply('No items to delete.');
        await ctx.reply('Select an item to delete:', telegraf_1.Markup.inlineKeyboard(buttons));
    });
    bot.action(/del_(\d+)_(\d+)/, async (ctx) => {
        try {
            if (!ctx.match)
                return;
            const sIndex = parseInt(ctx.match[1], 10);
            const iIndex = parseInt(ctx.match[2], 10);
            const sections = yamlAdmin_1.yamlAdmin.getSections();
            const section = sections[sIndex];
            const itemTitle = section?.items?.[iIndex]?.title;
            const sectionName = section?.name;
            if (!sectionName || !itemTitle) {
                await ctx.answerCbQuery('Item not found.', { show_alert: true });
                return;
            }
            const success = yamlAdmin_1.yamlAdmin.deleteItem(sectionName, itemTitle);
            if (success) {
                await ctx.answerCbQuery('Item deleted successfully!');
                await ctx.editMessageText(`✅ Deleted "${itemTitle}" from "${sectionName}"`);
            }
            else {
                await ctx.answerCbQuery('Failed to delete item.', { show_alert: true });
                await ctx.editMessageText(`❌ Failed to delete "${itemTitle}". It may not exist.`);
            }
        }
        catch (e) {
            logger_1.logger.error({ err: e }, 'Error in delete action');
        }
    });
};
exports.registerActions = registerActions;
// codded by https://github.com/dominatos
