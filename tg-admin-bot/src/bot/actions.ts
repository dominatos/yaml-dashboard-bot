import { Telegraf, Markup } from 'telegraf';
import { yamlAdmin } from '../service/yamlAdmin';
import { logger } from '../utils/logger';

export const registerActions = (bot: Telegraf<any>) => {
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
  
  bot.action('action_delete_item', async (ctx) => {
    await ctx.answerCbQuery();
    const sections = yamlAdmin.getSections();
    if (!sections.length) return ctx.reply('No sections/items found.');
    
    const buttons: any[] = [];
    sections.forEach((s) => {
      s.items?.forEach((i) => {
        const cbData = `del_${s.name}_${i.title}`.substring(0, 64);
        buttons.push([Markup.button.callback(`🗑️ ${i.title} (${s.name})`, cbData)]);
      });
    });

    if (buttons.length === 0) return ctx.reply('No items to delete.');
    await ctx.reply('Select an item to delete:', Markup.inlineKeyboard(buttons));
  });

  bot.action(/del_(.+)_(.+)/, async (ctx) => {
    try {
      if (!ctx.match) return;
      const sectionName = ctx.match[1];
      const itemTitle = ctx.match[2];

      const success = yamlAdmin.deleteItem(sectionName, itemTitle);
      
      if (success) {
        await ctx.answerCbQuery('Item deleted successfully!');
        await ctx.editMessageText(`✅ Deleted "${itemTitle}" from "${sectionName}"`);
      } else {
        await ctx.answerCbQuery('Failed to delete item.', { show_alert: true });
        await ctx.editMessageText(`❌ Failed to delete "${itemTitle}". It may not exist.`);
      }
    } catch (e) {
      logger.error({ err: e }, 'Error in delete action');
    }
  });
};

// codded by https://github.com/dominatos
