import { Scenes, Markup } from 'telegraf';
import { yamlAdmin } from '../service/yamlAdmin';

// Basic URL validation
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
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
    const buttons = sections.map(s => Markup.button.callback(s.name, `select_section_${s.name}`));
    await ctx.reply('Select a section or type a new section name:', Markup.inlineKeyboard(buttons, { columns: 2 }));
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      if (data.startsWith('select_section_')) {
        ctx.wizard.state.sectionName = data.replace('select_section_', '');
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
    if (!ctx.message || !('text' in ctx.message)) return;
    ctx.wizard.state.item.title = ctx.message.text.trim();
    await ctx.reply('Got it. Send a DESCRIPTION (or send /skip to leave empty):');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (ctx.message && 'text' in ctx.message) {
      const text = ctx.message.text.trim();
      if (text !== '/skip') {
        ctx.wizard.state.item.description = text;
      }
    }
    await ctx.reply('Send an ICON (e.g., si-github, mdi-server) or /skip:');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (ctx.message && 'text' in ctx.message) {
      const text = ctx.message.text.trim();
      if (text !== '/skip') {
        ctx.wizard.state.item.icon = text;
      }
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
    
    if (success) {
      await ctx.reply(`✅ Item "${item.title}" successfully added to section "${sectionName}".`);
    } else {
      await ctx.reply(`❌ Failed to add item. Check the logs.`);
    }
    
    return ctx.scene.leave();
  }
);

export const addSectionScene = new Scenes.WizardScene(
  'ADD_SECTION_SCENE',
  async (ctx: any) => {
    await ctx.reply('Send me the new Section name:');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    const name = ctx.message.text.trim();
    ctx.wizard.state.sectionName = name;
    await ctx.reply('Send an ICON (e.g., fas fa-folder) or /skip:');
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    let icon = undefined;
    if (ctx.message && 'text' in ctx.message) {
      const text = ctx.message.text.trim();
      if (text !== '/skip') icon = text;
    }
    const success = yamlAdmin.addSection(ctx.wizard.state.sectionName, icon);
    if (success) {
      await ctx.reply(`✅ Section added successfully.`);
    } else {
      await ctx.reply(`❌ Failed to add section.`);
    }
    return ctx.scene.leave();
  }
);

export const editItemScene = new Scenes.WizardScene(
  'EDIT_ITEM_SCENE',
  async (ctx: any) => {
    const sections = yamlAdmin.getSections();
    const buttons: any[] = [];
    sections.forEach(s => {
      s.items?.forEach(i => {
        const cb = `edi_${s.name}_${i.title}`.substring(0, 64);
        buttons.push([Markup.button.callback(`${i.title} (${s.name})`, cb)]);
      });
    });
    if (!buttons.length) {
      await ctx.reply('No items to edit.');
      return ctx.scene.leave();
    }
    await ctx.reply('Select an item to edit:', Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('edi_')) {
      const data = ctx.callbackQuery.data.split('_'); 
      data.shift(); // remove 'edi'
      const sectionName = data[0];
      const title = data.slice(1).join('_');
      ctx.wizard.state.sectionName = sectionName;
      ctx.wizard.state.oldTitle = title;
      await ctx.answerCbQuery();
      
      await ctx.reply('What property do you want to edit?', Markup.inlineKeyboard([
        [Markup.button.callback('Title', 'prop_title'), Markup.button.callback('Description', 'prop_description')],
        [Markup.button.callback('URL', 'prop_url'), Markup.button.callback('Icon', 'prop_icon')]
      ]));
      return ctx.wizard.next();
    }
  },
  async (ctx: any) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('prop_')) {
      ctx.wizard.state.propToEdit = ctx.callbackQuery.data.replace('prop_', '');
      await ctx.answerCbQuery();
      await ctx.reply(`Send the new value for ${ctx.wizard.state.propToEdit.toUpperCase()}:`);
      return ctx.wizard.next();
    }
  },
  async (ctx: any) => {
    if (ctx.message && 'text' in ctx.message) {
      const val = ctx.message.text.trim();
      const { sectionName, oldTitle, propToEdit } = ctx.wizard.state;
      const updatedProps: any = {};
      updatedProps[propToEdit] = val;
      
      const success = yamlAdmin.editItem(sectionName, oldTitle, updatedProps);
      if (success) {
        await ctx.reply(`✅ Item updated successfully.`);
      } else {
        await ctx.reply(`❌ Failed to update item.`);
      }
      return ctx.scene.leave();
    }
  }
);

export const manageSectionScene = new Scenes.WizardScene(
  'MANAGE_SECTION_SCENE',
  async (ctx: any) => {
    const sections = yamlAdmin.getSections();
    if (!sections.length) {
      await ctx.reply('No sections found.');
      return ctx.scene.leave();
    }
    const buttons = sections.map(s => Markup.button.callback(s.name, `selsec_${s.name}`));
    await ctx.reply('Select a section to manage:', Markup.inlineKeyboard(buttons, { columns: 2 }));
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('selsec_')) {
      ctx.wizard.state.sectionName = ctx.callbackQuery.data.replace('selsec_', '');
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
        await ctx.reply('No items to move.');
        return ctx.scene.leave();
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
      await ctx.reply(success ? `✅ Section renamed to "${newName}".` : '❌ Failed to rename.');
      return ctx.scene.leave();
    }
    
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery();
      
      if (data === 'cancel') {
        await ctx.reply('Cancelled operation.');
        return ctx.scene.leave();
      }
      
      if (mode === 'delete') {
        const sec = yamlAdmin.getSection(sectionName);
        if (!sec) {
            await ctx.reply('❌ Section not found.');
            return ctx.scene.leave();
        }

        if (data === 'del_all') {
           yamlAdmin.deleteSection(sectionName);
           await ctx.reply(`✅ Destroyed "${sectionName}".`);
           return ctx.scene.leave();
        } else if (data === 'del_keep_unsorted') {
           const items = sec.items || [];
           if (items.length > 0) {
             yamlAdmin.moveItems(items.map((i: any) => i.title), sectionName, 'Unsorted');
           }
           yamlAdmin.deleteSection(sectionName);
           await ctx.reply(`✅ Deleted "${sectionName}", protected items safely moved to Unsorted.`);
           return ctx.scene.leave();
        }
      }
      
      if (mode === 'move') {
        if (data === 'move_all') {
           const sections = yamlAdmin.getSections().filter(s => s.name !== sectionName);
           const buttons = sections.map(s => Markup.button.callback(s.name, `dest_${s.name}`));
           if (!buttons.length) buttons.push(Markup.button.callback('Create Unsorted', 'dest_Unsorted'));
           
           await ctx.reply('Select destination section:', Markup.inlineKeyboard(buttons, { columns: 2 }));
           return; // stay in state for destination click
        } else if (data.startsWith('dest_')) {
           const destSection = data.replace('dest_', '');
           const sec = yamlAdmin.getSection(sectionName);
           if (!sec || !sec.items) {
             await ctx.reply('❌ Error tracking items.'); 
             return ctx.scene.leave();
           }
           yamlAdmin.moveItems(sec.items.map((i: any)=>i.title), sectionName, destSection);
           await ctx.reply(`✅ Moved all items seamlessly to "${destSection}".`);
           return ctx.scene.leave();
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
    sections.forEach(s => {
      s.items?.forEach(i => {
        const cb = `mov_${s.name}_${i.title}`.substring(0, 64);
        buttons.push([Markup.button.callback(`${i.title} (${s.name})`, cb)]);
      });
    });
    if (!buttons.length) {
      await ctx.reply('No items found to move.');
      return ctx.scene.leave();
    }
    await ctx.reply('Select an item to move:', Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
  },
  async (ctx: any) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('mov_')) {
      const data = ctx.callbackQuery.data.split('_'); 
      data.shift(); // remove 'mov'
      const sectionName = data[0];
      const title = data.slice(1).join('_');
      ctx.wizard.state.sectionName = sectionName;
      ctx.wizard.state.itemTitle = title;
      await ctx.answerCbQuery();
      
      const sections = yamlAdmin.getSections().filter(s => s.name !== sectionName);
      const buttons = sections.map(s => Markup.button.callback(s.name, `dest_${s.name}`));
      if (!buttons.length) buttons.push(Markup.button.callback('Create Unsorted', 'dest_Unsorted'));
      
      await ctx.reply(`Move "${title}" to which section?`, Markup.inlineKeyboard(buttons, { columns: 2 }));
      return ctx.wizard.next();
    }
  },
  async (ctx: any) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('dest_')) {
      const destSection = ctx.callbackQuery.data.replace('dest_', '');
      const { sectionName, itemTitle } = ctx.wizard.state;
      await ctx.answerCbQuery();
      
      const success = yamlAdmin.moveItems([itemTitle], sectionName, destSection);
      if (success) {
        await ctx.reply(`✅ Item "${itemTitle}" successfully moved to "${destSection}".`);
      } else {
        await ctx.reply(`❌ Failed to move item.`);
      }
      return ctx.scene.leave();
    }
  }
);

export const stage = new Scenes.Stage([addItemScene, addSectionScene, editItemScene, manageSectionScene, moveItemScene]);


// codded by https://github.com/dominatos
