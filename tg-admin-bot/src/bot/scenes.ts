import { Scenes, Markup } from 'telegraf';
import { yamlAdmin, DashyNavLink } from '../service/yamlAdmin';
import { cleanupBotMessages } from '../utils/cleanup';
import { sendMainMenu } from './commands';

// Basic URL validation
const isValidUrl = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
};

const finishScene = async (ctx: any, message: string) => {
  await cleanupBotMessages(ctx);
  await ctx.scene.leave();
  return sendMainMenu(ctx, message);
};

export const addItemScene = new Scenes.WizardScene(
  'ADD_ITEM_SCENE',
  async (ctx: any) => {
    ctx.wizard.state.item = {};
    const sections = yamlAdmin.getSections();
    if (sections.length === 0) {
      await ctx.reply('No sections exist. Create one by typing its name:');
      return ctx.wizard.next();
    }
    const buttons = sections.map((s) => {
      const payload = `select_section_${s.name}`.substring(0, 64);
      return Markup.button.callback(s.name, payload);
    });
    await ctx.reply('Select a section or type a new section name:', Markup.inlineKeyboard(buttons, { columns: 2 }));
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      if (data.startsWith('select_section_')) {
        const name = data.replace('select_section_', '');
        ctx.wizard.state.sectionName = name || 'Unsorted';
        await ctx.answerCbQuery();
      }
    } else if (ctx.message && 'text' in ctx.message) {
      ctx.wizard.state.sectionName = ctx.message.text.trim();
    } else {
      await ctx.reply('Please pass valid text or select an option.');
      return;
    }
    await ctx.reply('Great. Send me the TITLE for the new item:');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please send valid text for the title.');
      return;
    }
    ctx.wizard.state.item.title = ctx.message.text.trim();
    await ctx.reply('Got it. Send a DESCRIPTION (or send /skip to leave empty):');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please send text or /skip to leave empty.');
      return;
    }
    const text = ctx.message.text.trim();
    if (text !== '/skip') {
      ctx.wizard.state.item.description = text;
    }
    await ctx.reply('Send an ICON (e.g., si-github, mdi-server) or /skip:');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please send text or /skip to leave empty.');
      return;
    }
    const text = ctx.message.text.trim();
    if (text !== '/skip') {
      ctx.wizard.state.item.icon = text;
    }
    await ctx.reply('Send the URL:');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (ctx.message && 'text' in ctx.message) {
      const url = ctx.message.text.trim();
      if (!isValidUrl(url)) {
        await ctx.reply('That does not look like a valid URL. Please send a valid HTTP/HTTPS URL:');
        return;
      }
      ctx.wizard.state.item.url = url;
    } else { return; }

    const { sectionName, item } = ctx.wizard.state;
    const success = yamlAdmin.addItem(sectionName, item);
    
    return finishScene(
      ctx,
      success
        ? `✅ Item "${item.title}" successfully added to section "${sectionName}".`
        : '❌ Failed to add item. Check the logs.'
    );
  }
);

export const addSectionScene = new Scenes.WizardScene(
  'ADD_SECTION_SCENE',
  async (ctx: any) => {
    await ctx.reply('Send me the new Section name:');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please send text for the section name.');
      return;
    }
    const name = ctx.message.text.trim();
    ctx.wizard.state.sectionName = name;
    await ctx.reply('Send an ICON (e.g., fas fa-folder) or /skip:');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please send text or /skip to leave empty.');
      return;
    }
    let icon = undefined;
    const text = ctx.message.text.trim();
    if (text !== '/skip') icon = text;
    const success = yamlAdmin.addSection(ctx.wizard.state.sectionName, icon);
    return finishScene(ctx, success ? '✅ Section added successfully.' : '❌ Failed to add section.');
  }
);

export const editItemScene = new Scenes.WizardScene(
  'EDIT_ITEM_SCENE',
  async (ctx: any) => {
    const sections = yamlAdmin.getSections();
    const buttons: any[] = [];
    sections.forEach((s, sIdx) => {
      s.items?.forEach((i, iIdx) => {
        const cb = `edi_${sIdx}_${iIdx}`;
        buttons.push([Markup.button.callback(`${i.title} (${s.name})`, cb)]);
      });
    });
    if (!buttons.length) {
      return finishScene(ctx, 'No items to edit.');
    }
    await ctx.reply('Select an item to edit:', Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('edi_')) {
      const data = ctx.callbackQuery.data.split('_'); 
      const sIdx = parseInt(data[1], 10);
      const iIdx = parseInt(data[2], 10);
      
      const sections = yamlAdmin.getSections();
      const sectionName = sections[sIdx]?.name;
      const title = sections[sIdx]?.items?.[iIdx]?.title;
      
      if (!sectionName || !title) {
        await ctx.answerCbQuery('Item not found.', { show_alert: true });
        await cleanupBotMessages(ctx);
        return ctx.scene.leave();
      }

      ctx.wizard.state.sectionName = sectionName;
      ctx.wizard.state.oldTitle = title;
      await ctx.answerCbQuery();
      
      await ctx.reply('What property do you want to edit?', Markup.inlineKeyboard([
        [Markup.button.callback('Title', 'prop_title'), Markup.button.callback('Description', 'prop_description')],
        [Markup.button.callback('URL', 'prop_url'), Markup.button.callback('Icon', 'prop_icon')]
      ]));
      return ctx.wizard.next();
    }
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      return;
    }
  },
  async (ctx: any) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('prop_')) {
      ctx.wizard.state.propToEdit = ctx.callbackQuery.data.replace('prop_', '');
      await ctx.answerCbQuery();
      await ctx.reply(`Send the new value for ${ctx.wizard.state.propToEdit.toUpperCase()}:`);
      return ctx.wizard.next();
    }
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      return;
    }
  },
  async (ctx: any) => {
    if (ctx.message && 'text' in ctx.message) {
      const val = ctx.message.text.trim();
      const { sectionName, oldTitle, propToEdit } = ctx.wizard.state;
      const updatedProps: any = {};
      updatedProps[propToEdit] = val;
      
      const success = yamlAdmin.editItem(sectionName, oldTitle, updatedProps);
      return finishScene(ctx, success ? '✅ Item updated successfully.' : '❌ Failed to update item.');
    }
  }
);

export const manageSectionScene = new Scenes.WizardScene(
  'MANAGE_SECTION_SCENE',
  async (ctx: any) => {
    const sections = yamlAdmin.getSections();
    if (!sections.length) {
      return finishScene(ctx, 'No sections found.');
    }
    const buttons = sections.map((s, idx) => Markup.button.callback(s.name, `selsec_${idx}`));
    await ctx.reply('Select a section to manage:', Markup.inlineKeyboard(buttons, { columns: 2 }));
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('selsec_')) {
      const idx = parseInt(ctx.callbackQuery.data.replace('selsec_', ''), 10);
      ctx.wizard.state.sectionName = yamlAdmin.getSections()[idx]?.name || '';
      await ctx.answerCbQuery();
      
      if (ctx.wizard.state.sectionName === 'Unsorted') {
         await ctx.reply('Managing protected Unsorted section', Markup.inlineKeyboard([
           [Markup.button.callback('Move Items', 'act_move')]
         ]));
      } else {
         await ctx.reply(`Managing "${ctx.wizard.state.sectionName}"`, Markup.inlineKeyboard([
           [Markup.button.callback('Rename', 'act_rename'), Markup.button.callback('Move Items', 'act_move')],
           [Markup.button.callback('Delete Section', 'act_delete')]
         ]));
      }
      return ctx.wizard.next();
    }
  },
  async (ctx: any) => {
    if (!ctx.callbackQuery) return;
    const action = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    if (action === 'act_rename') {
      ctx.wizard.state.mode = 'rename';
      await ctx.reply('Send the new section name:');
      return ctx.wizard.next();
    } else if (action === 'act_delete') {
      ctx.wizard.state.mode = 'delete';
      await ctx.reply('Are you sure you want to delete this section? What should we do with its items?', Markup.inlineKeyboard([
        [Markup.button.callback('Delete Section + All Items', 'del_all')],
        [Markup.button.callback('Move Items to Unsorted', 'del_keep_unsorted')],
        [Markup.button.callback('Cancel', 'cancel')]
      ]));
      return ctx.wizard.next();
    } else if (action === 'act_move') {
      ctx.wizard.state.mode = 'move';
      
      const sections = yamlAdmin.getSections();
      const sec = sections.find(s => s.name === ctx.wizard.state.sectionName);
      if (!sec || !sec.items || sec.items.length === 0) {
        return finishScene(ctx, 'No items to move.');
      }
      
      // We will move all items for MVP. Let's just do Move All directly to make logic clean.
      await ctx.reply('Move ALL items:', Markup.inlineKeyboard([
        [Markup.button.callback('Move ALL Items', 'move_all')],
        [Markup.button.callback('Cancel', 'cancel')]
      ]));
      return ctx.wizard.next();
    }
  },
  async (ctx: any) => {
    const { mode, sectionName } = ctx.wizard.state;

    if (mode === 'rename' && ctx.message && 'text' in ctx.message) {
      const newName = ctx.message.text.trim();
      const success = yamlAdmin.editSection(sectionName, newName);
      return finishScene(ctx, success ? `✅ Section renamed to "${newName}".` : '❌ Failed to rename.');
    }
    
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery();
      
      if (data === 'cancel') {
        return finishScene(ctx, 'Cancelled operation.');
      }
      
      if (mode === 'delete') {
        const sec = yamlAdmin.getSection(sectionName);
        if (!sec) {
            return finishScene(ctx, '❌ Section not found.');
        }

        if (data === 'del_all') {
           const success = yamlAdmin.deleteSection(sectionName);
           return finishScene(ctx, success ? `✅ Destroyed "${sectionName}".` : `❌ Failed to destroy "${sectionName}".`);
        } else if (data === 'del_keep_unsorted') {
           const items = sec.items || [];
           let moveSuccess = true;
           if (items.length > 0) {
             moveSuccess = yamlAdmin.moveItems(items.map((i: any) => i.title), sectionName, 'Unsorted');
           }
           if (!moveSuccess && items.length > 0) {
             return finishScene(ctx, `❌ Failed to move items, aborting deletion of "${sectionName}".`);
           } else {
             const delSuccess = yamlAdmin.deleteSection(sectionName);
             return finishScene(
               ctx,
               delSuccess
                 ? `✅ Deleted "${sectionName}", protected items safely moved to Unsorted.`
                 : `❌ Failed to delete "${sectionName}".`
             );
           }
        }
      }
      
      if (mode === 'move') {
        if (data === 'move_all') {
           const sections = yamlAdmin.getSections().filter(s => s.name !== sectionName);
           const buttons = sections.map(s => {
             const idx = yamlAdmin.getSections().findIndex(x => x.name === s.name);
             return Markup.button.callback(s.name, `dest_${idx}`);
           });
           if (!buttons.length) buttons.push(Markup.button.callback('Create Unsorted', 'dest_unsorted'));
           
           await ctx.reply('Select destination section:', Markup.inlineKeyboard(buttons, { columns: 2 }));
           return; // stay in state for destination click
        } else if (data.startsWith('dest_')) {
           const destVal = data.replace('dest_', '');
           let destSection = 'Unsorted';
           if (destVal !== 'unsorted') {
             const idx = parseInt(destVal, 10);
             destSection = yamlAdmin.getSections()[idx]?.name || 'Unsorted';
           }
           const sec = yamlAdmin.getSection(sectionName);
           if (!sec || !sec.items) {
             return finishScene(ctx, '❌ Error tracking items.');
           }
           const success = yamlAdmin.moveItems(sec.items.map((i: any)=>i.title), sectionName, destSection);
           return finishScene(
             ctx,
             success
               ? `✅ Moved all items seamlessly to "${destSection}".`
               : `❌ Failed to move items to "${destSection}".`
           );
        }
      }
    }
  }
);

export const moveItemScene = new Scenes.WizardScene(
  'MOVE_ITEM_SCENE',
  async (ctx: any) => {
    const sections = yamlAdmin.getSections();
    const buttons: any[] = [];
    sections.forEach((s, sIdx) => {
      s.items?.forEach((i, iIdx) => {
        const cb = `mov_${sIdx}_${iIdx}`;
        buttons.push([Markup.button.callback(`${i.title} (${s.name})`, cb)]);
      });
    });
    if (!buttons.length) {
      return finishScene(ctx, 'No items found to move.');
    }
    await ctx.reply('Select an item to move:', Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('mov_')) {
      const data = ctx.callbackQuery.data.split('_'); 
      const sIdx = parseInt(data[1], 10);
      const iIdx = parseInt(data[2], 10);
      
      const sections = yamlAdmin.getSections();
      const sectionName = sections[sIdx]?.name;
      const title = sections[sIdx]?.items?.[iIdx]?.title;
      
      if (!sectionName || !title) {
        await ctx.answerCbQuery('Item not found.', { show_alert: true });
        return finishScene(ctx, 'Item not found.');
      }
      
      ctx.wizard.state.sectionName = sectionName;
      ctx.wizard.state.itemTitle = title;
      await ctx.answerCbQuery();
      
      const sectionsRemaining = yamlAdmin.getSections().filter(s => s.name !== sectionName);
      const buttons = sectionsRemaining.map(s => {
         const idx = yamlAdmin.getSections().findIndex(x => x.name === s.name);
         return Markup.button.callback(s.name, `dest_${idx}`);
      });
      if (!buttons.length) buttons.push(Markup.button.callback('Create Unsorted', 'dest_unsorted'));
      
      await ctx.reply(`Move "${title}" to which section?`, Markup.inlineKeyboard(buttons, { columns: 2 }));
      return ctx.wizard.next();
    }
  },
  async (ctx: any) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('dest_')) {
      const destVal = ctx.callbackQuery.data.replace('dest_', '');
      let destSection = 'Unsorted';
      if (destVal !== 'unsorted') {
        const idx = parseInt(destVal, 10);
        destSection = yamlAdmin.getSections()[idx]?.name || 'Unsorted';
      }
      
      const { sectionName, itemTitle } = ctx.wizard.state;
      await ctx.answerCbQuery();
      
      const success = yamlAdmin.moveItems([itemTitle], sectionName, destSection);
      return finishScene(
        ctx,
        success
          ? `✅ Item "${itemTitle}" successfully moved to "${destSection}".`
          : '❌ Failed to move item.'
      );
    }
  }
);

export const manageNavLinksScene = new Scenes.WizardScene(
  'MANAGE_NAVLINKS_SCENE',
  // Step 1: Show current navLinks + action buttons
  async (ctx: any) => {
    const navLinks = yamlAdmin.getNavLinks();
    let msg = '🔗 *Top Navigation Links*\n\n';
    if (navLinks.length === 0) {
      msg += '_No nav links configured yet._\n';
    } else {
      navLinks.forEach((n, i) => msg += `${i + 1}. ${n.title} → \`${n.path}\`\n`);
    }
    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('➕ Add NavLink', 'nl_add'), Markup.button.callback('🗑️ Delete NavLink', 'nl_delete')],
        [Markup.button.callback('❌ Cancel', 'nl_cancel')]
      ])
    });
    return ctx.wizard.next();
  },
  // Step 2: Route by action choice
  async (ctx: any) => {
    if (!ctx.callbackQuery) return;
    const action = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    if (action === 'nl_cancel') {
      return finishScene(ctx, 'Cancelled.');
    }
    if (action === 'nl_add') {
      ctx.wizard.state.mode = 'add';
      await ctx.reply('Send the TITLE for the new nav link (e.g. Grafana):');
      return ctx.wizard.next();
    }
    if (action === 'nl_delete') {
      ctx.wizard.state.mode = 'delete';
      const navLinks = yamlAdmin.getNavLinks();
      if (navLinks.length === 0) {
        return finishScene(ctx, 'No nav links to delete.');
      }
      const buttons = navLinks.map((n, idx) =>
        [Markup.button.callback(`🗑️ ${n.title}`, `nldel_${idx}`)]
      );
      buttons.push([Markup.button.callback('❌ Cancel', 'nl_cancel')]);
      await ctx.reply('Select a nav link to delete:', Markup.inlineKeyboard(buttons));
      return ctx.wizard.next();
    }
  },
  // Step 3a (Add): collect title then URL
  async (ctx: any) => {
    const { mode } = ctx.wizard.state;

    // Delete path: handle button click
    if (mode === 'delete' && ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery();
      if (data === 'nl_cancel') {
        return finishScene(ctx, 'Cancelled.');
      }
      if (data.startsWith('nldel_')) {
        const idx = Number(data.replace('nldel_', ''));
        const navLinks = yamlAdmin.getNavLinks();
        const navLink = navLinks[idx];
        if (!navLink) {
          return finishScene(ctx, '❌ Nav link not found.');
        }
        const title = navLink.title;
        const success = yamlAdmin.deleteNavLink(title);
        return finishScene(ctx, success ? `✅ NavLink "${title}" deleted.` : `❌ Failed to delete "${title}".`);
      }
      return;
    }

    // Add path: collect title
    if (mode === 'add' && ctx.message && 'text' in ctx.message) {
      const title = ctx.message.text.trim();
      if (!title) {
        await ctx.reply('Title cannot be empty. Send the TITLE:');
        return;
      }
      ctx.wizard.state.navLinkTitle = title;
      await ctx.reply('Send the URL (e.g. http://192.168.1.26:3001):');
      return ctx.wizard.next();
    }
  },
  // Step 3b (Add): collect URL and save
  async (ctx: any) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please send a valid URL.');
      return;
    }
    const url = ctx.message.text.trim();
    if (!isValidUrl(url)) {
      await ctx.reply('That does not look like a valid URL. Please try again:');
      return;
    }
    const navLink: DashyNavLink = {
      title: ctx.wizard.state.navLinkTitle,
      path: url,
      target: 'newtab'
    };
    const success = yamlAdmin.addNavLink(navLink);
    return finishScene(
      ctx,
      success
        ? `✅ NavLink "${navLink.title}" added.`
        : '❌ Failed to add NavLink — a link with that title may already exist.'
    );
  }
);

export const manageSubItemsScene = new Scenes.WizardScene(
  'MANAGE_SUBITEMS_SCENE',
  // Step 1: Select an item from all sections
  async (ctx: any) => {
    const sections = yamlAdmin.getSections();
    const buttons: any[] = [];
    sections.forEach((s) => {
      s.items?.forEach((i) => {
        if (i.id) {
          buttons.push([Markup.button.callback(`${i.title} (${s.name})`, `subi_${i.id}`)]);
        }
      });
    });
    if (!buttons.length) {
      return finishScene(ctx, 'No items found.');
    }
    await ctx.reply('Select an item to manage sub-links for:', Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },
  // Step 2: Show current subItems + action buttons
  async (ctx: any) => {
    if (!ctx.callbackQuery?.data?.startsWith('subi_')) return;
    const itemId = ctx.callbackQuery.data.replace('subi_', '');
    await ctx.answerCbQuery();

    const result = yamlAdmin.getItemById(itemId);
    if (!result) {
      return finishScene(ctx, '❌ Item not found.');
    }

    ctx.wizard.state.itemId = itemId;
    ctx.wizard.state.itemTitle = result.item.title;

    const subItems = result.item.subItems || [];
    let msg = `🔗 *Sub-links for "${result.item.title}"*\n\n`;
    if (subItems.length === 0) {
      msg += '_No sub-links yet._';
      if (result.item.url) {
        msg += `\n\n📌 Current URL: \`${result.item.url}\`\n_(Adding the first sub-link will auto-convert this into an "Open" sub-link)_`;
      }
    } else {
      subItems.forEach((s, i) => msg += `${i + 1}. ${s.title} → \`${s.url}\`\n`);
    }
    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('➕ Add Sub-Link', 'sl_add'), Markup.button.callback('🗑️ Remove Sub-Link', 'sl_delete')],
        [Markup.button.callback('❌ Cancel', 'sl_cancel')]
      ])
    });
    return ctx.wizard.next();
  },
  // Step 3: Route by action choice
  async (ctx: any) => {
    if (!ctx.callbackQuery) return;
    const action = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    if (action === 'sl_cancel') {
      return finishScene(ctx, 'Cancelled.');
    }
    if (action === 'sl_add') {
      ctx.wizard.state.mode = 'add';
      await ctx.reply('Send the TITLE for the new sub-link (e.g. Local):');
      return ctx.wizard.next();
    }
    if (action === 'sl_delete') {
      ctx.wizard.state.mode = 'delete';
      const subItems = yamlAdmin.getSubItems(ctx.wizard.state.itemId);
      if (subItems.length === 0) {
        return finishScene(ctx, 'No sub-links to remove.');
      }
      const buttons = subItems.map((s, i) =>
        [Markup.button.callback(`🗑️ ${s.title}`, `sldel_${i}`)]
      );
      buttons.push([Markup.button.callback('❌ Cancel', 'sl_cancel')]);
      await ctx.reply('Select a sub-link to remove:', Markup.inlineKeyboard(buttons));
      return ctx.wizard.next();
    }
  },
  // Step 4a (Add): collect title then URL
  async (ctx: any) => {
    const { mode, itemId, itemTitle } = ctx.wizard.state;

    // Delete path: handle button click
    if (mode === 'delete' && ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery();
      if (data === 'sl_cancel') {
        return finishScene(ctx, 'Cancelled.');
      }
      if (data.startsWith('sldel_')) {
        const idx = Number(data.replace('sldel_', ''));
        const subItems = yamlAdmin.getSubItems(itemId);
        const subItem = subItems[idx];
        if (!subItem) {
          return finishScene(ctx, '❌ Sub-link not found.');
        }
        const subTitle = subItem.title;
        const success = yamlAdmin.deleteSubItem(itemId, subTitle);
        return finishScene(
          ctx,
          success
            ? `✅ Sub-link "${subTitle}" removed from "${itemTitle}".`
            : `❌ Failed to remove "${subTitle}".`
        );
      }
      return;
    }

    // Add path: collect title
    if (mode === 'add' && ctx.message && 'text' in ctx.message) {
      const title = ctx.message.text.trim();
      if (!title) {
        await ctx.reply('Title cannot be empty. Send the TITLE:');
        return;
      }
      ctx.wizard.state.subItemTitle = title;
      await ctx.reply('Send the URL for this sub-link:');
      return ctx.wizard.next();
    }
  },
  // Step 4b (Add): collect URL and save
  async (ctx: any) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please send a valid URL.');
      return;
    }
    const url = ctx.message.text.trim();
    if (!isValidUrl(url)) {
      await ctx.reply('That does not look like a valid URL. Please try again:');
      return;
    }
    const { itemId, itemTitle, subItemTitle } = ctx.wizard.state;
    const success = yamlAdmin.addSubItem(itemId, { title: subItemTitle, url });
    return finishScene(
      ctx,
      success
        ? `✅ Sub-link "${subItemTitle}" added to "${itemTitle}".`
        : '❌ Failed to add sub-link — a sub-link with that title may already exist.'
    );
  }
);

export const stage = new Scenes.Stage([addItemScene, addSectionScene, editItemScene, manageSectionScene, moveItemScene, manageNavLinksScene, manageSubItemsScene]);


// codded by https://github.com/dominatos
