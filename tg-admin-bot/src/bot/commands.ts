import { Telegraf, Markup } from 'telegraf';
import { yamlAdmin } from '../service/yamlAdmin';
import { cleanupBotMessages } from '../utils/cleanup';

const escapeMd = (text: string) => text.replace(/[_*\[\]`]/g, '\\$&');

export const registerCommands = (bot: Telegraf<any>) => {
  bot.command('start', (ctx) => {
    ctx.reply(
      '👋 Welcome to the Dashy Admin Bot!\n\nUse /help to see all available commands.',
      Markup.removeKeyboard()
    );
  });

  bot.command('help', (ctx) => {
    ctx.reply(
      '🛠️ **Admin Commands**\n' +
      '/sections - List all sections\n' +
      '/items - List all items\n' +
      '/add - Add a new item\n' +
      '/delete - Delete an item\n' +
      '/edit - Edit an item\n' +
      '/add_section - Create a new section\n' +
      '/manage_sections - Rename, Move items, or Delete Sections\n' +
      '/cancel - Cancel any current operation'
    );
  });

  bot.command('sections', async (ctx) => {
    const sections = yamlAdmin.getSections();
    if (!sections.length) return ctx.reply('No sections found.');
    let msg = '📂 *Sections*\n\n';
    sections.forEach(s => msg += `- ${escapeMd(s.name)} (${s.items?.length || 0} items)\n`);
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('➕ Add Section', 'action_add_section'), Markup.button.callback('🔧 Manage', 'action_manage_sections')]
    ]);
    await cleanupBotMessages(ctx);
    ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
  });

  bot.command('items', async (ctx) => {
    const sections = yamlAdmin.getSections();
    if (!sections.length) return ctx.reply('No items found.');
    let msg = '📦 *Items*\n\n';
    sections.forEach(s => {
      msg += `*${escapeMd(s.name)}*\n`;
      s.items?.forEach(i => msg += ` - ${escapeMd(i.title)}\n`);
      msg += '\n';
    });
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('➕ Add Item', 'action_add_item'), Markup.button.callback('✏️ Edit Item', 'action_edit_item')],
      [Markup.button.callback('➡️ Move Item', 'action_move_item'), Markup.button.callback('🗑️ Delete Item', 'action_delete_item')]
    ]);
    await cleanupBotMessages(ctx);
    ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
  });

  bot.command('cancel', async (ctx) => {
    if (ctx.scene) {
      await ctx.scene.leave();
    }
    ctx.reply('Any active operation has been cancelled.');
  });

  bot.command('add', (ctx) => {
    ctx.scene.enter('ADD_ITEM_SCENE');
  });

  bot.command('edit', (ctx) => {
    ctx.scene.enter('EDIT_ITEM_SCENE');
  });

  bot.command('add_section', (ctx) => {
    ctx.scene.enter('ADD_SECTION_SCENE');
  });

  bot.command('manage_sections', (ctx) => {
    ctx.scene.enter('MANAGE_SECTION_SCENE');
  });

  bot.command('delete', async (ctx) => {
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
    ctx.reply('Select an item to delete:', Markup.inlineKeyboard(buttons));
  });

  bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();


    // Find a URL in the message, even without http(s)://
    const urlMatch = text.match(/(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i);
    if (!urlMatch) return;
    
    let url = urlMatch[1];
    let title = text.replace(url, '').trim();
    // Optional: strip generic dashes/newlines if they separated them e.g., "Title - https://url"
    title = title.replace(/^[\n\r\-]+|[\n\r\-]+$/g, '').trim();

    // Auto-prepend https:// if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      new URL(url);
    } catch(e) {
      return; // Not a valid URL structure
    }

    await ctx.reply('⏳ Adding your link...');

    if (!title) {
      title = 'New Link';
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.toLowerCase().includes('text/html') && response.body) {
        const reader = response.body.getReader();
        let bytesRead = 0;
        let chunks = [];
        const MAX_BYTES = 64 * 1024; // 64KB
        
        while (bytesRead < MAX_BYTES) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          bytesRead += value.length;
        }
        reader.cancel().catch(() => {});
        
        const html = Buffer.concat(chunks).toString('utf-8');
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        
        if (match && match[1]) {
          title = match[1].trim()
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[\x00-\x1F\x7F]/g, '');

          if (title.length > 50) {
            title = title.substring(0, 47) + '...';
          }
        } else {
          const u = new URL(url);
          title = (u.hostname + (u.pathname === '/' ? '' : u.pathname)).substring(0, 30);
        }
      } else {
        const u = new URL(url);
        title = (u.hostname + (u.pathname === '/' ? '' : u.pathname)).substring(0, 30);
      }
    } catch (e) {
      const u = new URL(url);
      title = (u.hostname + (u.pathname === '/' ? '' : u.pathname)).substring(0, 30);
    }

    const sectionName = 'Unsorted';
    const item = {
      title: title,
      url: url,
      icon: 'fas fa-link'
    };

    const success = yamlAdmin.addItem(sectionName, item);
    if (success) {
      await ctx.reply(`✅ Added "${title}" to "${sectionName}".`);
    } else {
      await ctx.reply(`❌ Failed to automatically add link.`);
    }
  });
};

// codded by https://github.com/dominatos
