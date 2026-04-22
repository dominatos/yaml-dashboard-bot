import { Telegraf, Markup } from 'telegraf';
import { yamlAdmin } from '../service/yamlAdmin';
import { logger } from '../utils/logger';
import { cleanupBotMessages } from '../utils/cleanup';
import { sendItemsList, sendMainMenu, sendSectionsList } from './commands';

export const registerActions = (bot: Telegraf<any>) => {
  bot.action('action_list_sections', async (ctx) => {
    await ctx.answerCbQuery();
    await sendSectionsList(ctx);
  });

  bot.action('action_list_items', async (ctx) => {
    await ctx.answerCbQuery();
    await sendItemsList(ctx);
  });

  bot.action('action_add_section', async (ctx) => {
    await ctx.answerCbQuery();
    await (ctx as any).scene.enter('ADD_SECTION_SCENE');
  });
  
  bot.action('action_manage_sections', async (ctx) => {
    await ctx.answerCbQuery();
    await (ctx as any).scene.enter('MANAGE_SECTION_SCENE');
  });
  
  bot.action('action_add_item', async (ctx) => {
    await ctx.answerCbQuery();
    await (ctx as any).scene.enter('ADD_ITEM_SCENE');
  });
  
  bot.action('action_edit_item', async (ctx) => {
    await ctx.answerCbQuery();
    await (ctx as any).scene.enter('EDIT_ITEM_SCENE');
  });
  
  bot.action('action_move_item', async (ctx) => {
    await ctx.answerCbQuery();
    await (ctx as any).scene.enter('MOVE_ITEM_SCENE');
  });

  bot.action('action_manage_navlinks', async (ctx) => {
    await ctx.answerCbQuery();
    await (ctx as any).scene.enter('MANAGE_NAVLINKS_SCENE');
  });

  bot.action('action_manage_sublinks', async (ctx) => {
    await ctx.answerCbQuery();
    await (ctx as any).scene.enter('MANAGE_SUBITEMS_SCENE');
  });
  
  bot.action('action_delete_item', async (ctx) => {
    await ctx.answerCbQuery();
    const sections = yamlAdmin.getSections();
    if (!sections.length) return ctx.reply('No sections/items found.');
    
    const buttons: any[] = [];
    sections.forEach((s) => {
      s.items?.forEach((i) => {
        const cbData = `del_${i.id}`;
        buttons.push([Markup.button.callback(`🗑️ ${i.title} (${s.name})`, cbData)]);
      });
    });

    if (buttons.length === 0) return ctx.reply('No items to delete.');
    await cleanupBotMessages(ctx);
    await ctx.reply('Select an item to delete:', Markup.inlineKeyboard(buttons));
  });

  bot.action(/del_(.+)/, async (ctx) => {
    try {
      if (!ctx.match) return;
      const itemId = ctx.match[1];

      const itemInfo = yamlAdmin.getItemById(itemId);
      if (!itemInfo) {
        await ctx.answerCbQuery('Item not found.', { show_alert: true });
        return;
      }

      const { section, item } = itemInfo;
      const success = yamlAdmin.deleteItemById(itemId);
      
      await cleanupBotMessages(ctx);
      if (success) {
        await ctx.answerCbQuery('Item deleted successfully!');
        await ctx.editMessageText(`✅ Deleted "${item.title}" from "${section.name}"`);
        await sendMainMenu(ctx);
      } else {
        await ctx.answerCbQuery('Failed to delete item.', { show_alert: true });
        await ctx.editMessageText(`❌ Failed to delete "${item.title}". It may not exist.`);
        await sendMainMenu(ctx);
      }
    } catch (e) {
      logger.error({ err: e }, 'Error in delete action');
    }
  });
};

// codded by https://github.com/dominatos
