"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stage = exports.moveItemScene = exports.manageSectionScene = exports.editItemScene = exports.addSectionScene = exports.addItemScene = void 0;
const telegraf_1 = require("telegraf");
const yamlAdmin_1 = require("../service/yamlAdmin");
const cleanup_1 = require("../utils/cleanup");
// Basic URL validation
const isValidUrl = (url) => {
    try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
    }
    catch (e) {
        return false;
    }
};
exports.addItemScene = new telegraf_1.Scenes.WizardScene('ADD_ITEM_SCENE', async (ctx) => {
    ctx.wizard.state.item = {};
    const sections = yamlAdmin_1.yamlAdmin.getSections();
    if (sections.length === 0) {
        await ctx.reply('No sections exist. Create one by typing its name:');
        return ctx.wizard.next();
    }
    const buttons = sections.map((s) => {
        const payload = `select_section_${s.name}`.substring(0, 64);
        return telegraf_1.Markup.button.callback(s.name, payload);
    });
    await ctx.reply('Select a section or type a new section name:', telegraf_1.Markup.inlineKeyboard(buttons, { columns: 2 }));
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (data.startsWith('select_section_')) {
            const name = data.replace('select_section_', '');
            ctx.wizard.state.sectionName = name || 'Unsorted';
            await ctx.answerCbQuery();
        }
    }
    else if (ctx.message && 'text' in ctx.message) {
        ctx.wizard.state.sectionName = ctx.message.text.trim();
    }
    else {
        await ctx.reply('Please pass valid text or select an option.');
        return;
    }
    await ctx.reply('Great. Send me the TITLE for the new item:');
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please send valid text for the title.');
        return;
    }
    ctx.wizard.state.item.title = ctx.message.text.trim();
    await ctx.reply('Got it. Send a DESCRIPTION (or send /skip to leave empty):');
    return ctx.wizard.next();
}, async (ctx) => {
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
}, async (ctx) => {
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
}, async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
        const url = ctx.message.text.trim();
        if (!isValidUrl(url)) {
            await ctx.reply('That does not look like a valid URL. Please send a valid HTTP/HTTPS URL:');
            return;
        }
        ctx.wizard.state.item.url = url;
    }
    else {
        return;
    }
    const { sectionName, item } = ctx.wizard.state;
    const success = yamlAdmin_1.yamlAdmin.addItem(sectionName, item);
    await (0, cleanup_1.cleanupBotMessages)(ctx);
    if (success) {
        await ctx.reply(`✅ Item "${item.title}" successfully added to section "${sectionName}".`);
    }
    else {
        await ctx.reply(`❌ Failed to add item. Check the logs.`);
    }
    return ctx.scene.leave();
});
exports.addSectionScene = new telegraf_1.Scenes.WizardScene('ADD_SECTION_SCENE', async (ctx) => {
    await ctx.reply('Send me the new Section name:');
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please send text for the section name.');
        return;
    }
    const name = ctx.message.text.trim();
    ctx.wizard.state.sectionName = name;
    await ctx.reply('Send an ICON (e.g., fas fa-folder) or /skip:');
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please send text or /skip to leave empty.');
        return;
    }
    let icon = undefined;
    const text = ctx.message.text.trim();
    if (text !== '/skip')
        icon = text;
    const success = yamlAdmin_1.yamlAdmin.addSection(ctx.wizard.state.sectionName, icon);
    await (0, cleanup_1.cleanupBotMessages)(ctx);
    if (success) {
        await ctx.reply(`✅ Section added successfully.`);
    }
    else {
        await ctx.reply(`❌ Failed to add section.`);
    }
    return ctx.scene.leave();
});
exports.editItemScene = new telegraf_1.Scenes.WizardScene('EDIT_ITEM_SCENE', async (ctx) => {
    const sections = yamlAdmin_1.yamlAdmin.getSections();
    const buttons = [];
    sections.forEach((s, sIdx) => {
        s.items?.forEach((i, iIdx) => {
            const cb = `edi_${sIdx}_${iIdx}`;
            buttons.push([telegraf_1.Markup.button.callback(`${i.title} (${s.name})`, cb)]);
        });
    });
    if (!buttons.length) {
        await ctx.reply('No items to edit.');
        await (0, cleanup_1.cleanupBotMessages)(ctx);
        return ctx.scene.leave();
    }
    await ctx.reply('Select an item to edit:', telegraf_1.Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('edi_')) {
        const data = ctx.callbackQuery.data.split('_');
        const sIdx = parseInt(data[1], 10);
        const iIdx = parseInt(data[2], 10);
        const sections = yamlAdmin_1.yamlAdmin.getSections();
        const sectionName = sections[sIdx]?.name;
        const title = sections[sIdx]?.items?.[iIdx]?.title;
        if (!sectionName || !title) {
            await ctx.answerCbQuery('Item not found.', { show_alert: true });
            await (0, cleanup_1.cleanupBotMessages)(ctx);
            return ctx.scene.leave();
        }
        ctx.wizard.state.sectionName = sectionName;
        ctx.wizard.state.oldTitle = title;
        await ctx.answerCbQuery();
        await ctx.reply('What property do you want to edit?', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('Title', 'prop_title'), telegraf_1.Markup.button.callback('Description', 'prop_description')],
            [telegraf_1.Markup.button.callback('URL', 'prop_url'), telegraf_1.Markup.button.callback('Icon', 'prop_icon')]
        ]));
        return ctx.wizard.next();
    }
    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
        return;
    }
}, async (ctx) => {
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
}, async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
        const val = ctx.message.text.trim();
        const { sectionName, oldTitle, propToEdit } = ctx.wizard.state;
        const updatedProps = {};
        updatedProps[propToEdit] = val;
        const success = yamlAdmin_1.yamlAdmin.editItem(sectionName, oldTitle, updatedProps);
        await (0, cleanup_1.cleanupBotMessages)(ctx);
        if (success) {
            await ctx.reply(`✅ Item updated successfully.`);
        }
        else {
            await ctx.reply(`❌ Failed to update item.`);
        }
        return ctx.scene.leave();
    }
});
exports.manageSectionScene = new telegraf_1.Scenes.WizardScene('MANAGE_SECTION_SCENE', async (ctx) => {
    const sections = yamlAdmin_1.yamlAdmin.getSections();
    if (!sections.length) {
        await ctx.reply('No sections found.');
        await (0, cleanup_1.cleanupBotMessages)(ctx);
        return ctx.scene.leave();
    }
    const buttons = sections.map((s, idx) => telegraf_1.Markup.button.callback(s.name, `selsec_${idx}`));
    await ctx.reply('Select a section to manage:', telegraf_1.Markup.inlineKeyboard(buttons, { columns: 2 }));
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('selsec_')) {
        const idx = parseInt(ctx.callbackQuery.data.replace('selsec_', ''), 10);
        ctx.wizard.state.sectionName = yamlAdmin_1.yamlAdmin.getSections()[idx]?.name || '';
        await ctx.answerCbQuery();
        if (ctx.wizard.state.sectionName === 'Unsorted') {
            await ctx.reply('Managing protected Unsorted section', telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('Move Items', 'act_move')]
            ]));
        }
        else {
            await ctx.reply(`Managing "${ctx.wizard.state.sectionName}"`, telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('Rename', 'act_rename'), telegraf_1.Markup.button.callback('Move Items', 'act_move')],
                [telegraf_1.Markup.button.callback('Delete Section', 'act_delete')]
            ]));
        }
        return ctx.wizard.next();
    }
}, async (ctx) => {
    if (!ctx.callbackQuery)
        return;
    const action = ctx.callbackQuery.data;
    await ctx.answerCbQuery();
    if (action === 'act_rename') {
        ctx.wizard.state.mode = 'rename';
        await ctx.reply('Send the new section name:');
        return ctx.wizard.next();
    }
    else if (action === 'act_delete') {
        ctx.wizard.state.mode = 'delete';
        await ctx.reply('Are you sure you want to delete this section? What should we do with its items?', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('Delete Section + All Items', 'del_all')],
            [telegraf_1.Markup.button.callback('Move Items to Unsorted', 'del_keep_unsorted')],
            [telegraf_1.Markup.button.callback('Cancel', 'cancel')]
        ]));
        return ctx.wizard.next();
    }
    else if (action === 'act_move') {
        ctx.wizard.state.mode = 'move';
        const sections = yamlAdmin_1.yamlAdmin.getSections();
        const sec = sections.find(s => s.name === ctx.wizard.state.sectionName);
        if (!sec || !sec.items || sec.items.length === 0) {
            await ctx.reply('No items to move.');
            await (0, cleanup_1.cleanupBotMessages)(ctx);
            return ctx.scene.leave();
        }
        // We will move all items for MVP. Let's just do Move All directly to make logic clean.
        await ctx.reply('Move ALL items:', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('Move ALL Items', 'move_all')],
            [telegraf_1.Markup.button.callback('Cancel', 'cancel')]
        ]));
        return ctx.wizard.next();
    }
}, async (ctx) => {
    const { mode, sectionName } = ctx.wizard.state;
    if (mode === 'rename' && ctx.message && 'text' in ctx.message) {
        const newName = ctx.message.text.trim();
        const success = yamlAdmin_1.yamlAdmin.editSection(sectionName, newName);
        await (0, cleanup_1.cleanupBotMessages)(ctx);
        await ctx.reply(success ? `✅ Section renamed to "${newName}".` : '❌ Failed to rename.');
        return ctx.scene.leave();
    }
    if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        await ctx.answerCbQuery();
        if (data === 'cancel') {
            await ctx.reply('Cancelled operation.');
            await (0, cleanup_1.cleanupBotMessages)(ctx);
            return ctx.scene.leave();
        }
        if (mode === 'delete') {
            const sec = yamlAdmin_1.yamlAdmin.getSection(sectionName);
            if (!sec) {
                await ctx.reply('❌ Section not found.');
                await (0, cleanup_1.cleanupBotMessages)(ctx);
                return ctx.scene.leave();
            }
            if (data === 'del_all') {
                const success = yamlAdmin_1.yamlAdmin.deleteSection(sectionName);
                await (0, cleanup_1.cleanupBotMessages)(ctx);
                if (success) {
                    await ctx.reply(`✅ Destroyed "${sectionName}".`);
                }
                else {
                    await ctx.reply(`❌ Failed to destroy "${sectionName}".`);
                }
                return ctx.scene.leave();
            }
            else if (data === 'del_keep_unsorted') {
                const items = sec.items || [];
                let moveSuccess = true;
                if (items.length > 0) {
                    moveSuccess = yamlAdmin_1.yamlAdmin.moveItems(items.map((i) => i.title), sectionName, 'Unsorted');
                }
                await (0, cleanup_1.cleanupBotMessages)(ctx);
                if (!moveSuccess && items.length > 0) {
                    await ctx.reply(`❌ Failed to move items, aborting deletion of "${sectionName}".`);
                }
                else {
                    const delSuccess = yamlAdmin_1.yamlAdmin.deleteSection(sectionName);
                    if (delSuccess) {
                        await ctx.reply(`✅ Deleted "${sectionName}", protected items safely moved to Unsorted.`);
                    }
                    else {
                        await ctx.reply(`❌ Failed to delete "${sectionName}".`);
                    }
                }
                return ctx.scene.leave();
            }
        }
        if (mode === 'move') {
            if (data === 'move_all') {
                const sections = yamlAdmin_1.yamlAdmin.getSections().filter(s => s.name !== sectionName);
                const buttons = sections.map(s => {
                    const idx = yamlAdmin_1.yamlAdmin.getSections().findIndex(x => x.name === s.name);
                    return telegraf_1.Markup.button.callback(s.name, `dest_${idx}`);
                });
                if (!buttons.length)
                    buttons.push(telegraf_1.Markup.button.callback('Create Unsorted', 'dest_unsorted'));
                await ctx.reply('Select destination section:', telegraf_1.Markup.inlineKeyboard(buttons, { columns: 2 }));
                return; // stay in state for destination click
            }
            else if (data.startsWith('dest_')) {
                const destVal = data.replace('dest_', '');
                let destSection = 'Unsorted';
                if (destVal !== 'unsorted') {
                    const idx = parseInt(destVal, 10);
                    destSection = yamlAdmin_1.yamlAdmin.getSections()[idx]?.name || 'Unsorted';
                }
                const sec = yamlAdmin_1.yamlAdmin.getSection(sectionName);
                if (!sec || !sec.items) {
                    await ctx.reply('❌ Error tracking items.');
                    await (0, cleanup_1.cleanupBotMessages)(ctx);
                    return ctx.scene.leave();
                }
                const success = yamlAdmin_1.yamlAdmin.moveItems(sec.items.map((i) => i.title), sectionName, destSection);
                await (0, cleanup_1.cleanupBotMessages)(ctx);
                if (success) {
                    await ctx.reply(`✅ Moved all items seamlessly to "${destSection}".`);
                }
                else {
                    await ctx.reply(`❌ Failed to move items to "${destSection}".`);
                }
                return ctx.scene.leave();
            }
        }
    }
});
exports.moveItemScene = new telegraf_1.Scenes.WizardScene('MOVE_ITEM_SCENE', async (ctx) => {
    const sections = yamlAdmin_1.yamlAdmin.getSections();
    const buttons = [];
    sections.forEach((s, sIdx) => {
        s.items?.forEach((i, iIdx) => {
            const cb = `mov_${sIdx}_${iIdx}`;
            buttons.push([telegraf_1.Markup.button.callback(`${i.title} (${s.name})`, cb)]);
        });
    });
    if (!buttons.length) {
        await ctx.reply('No items found to move.');
        await (0, cleanup_1.cleanupBotMessages)(ctx);
        return ctx.scene.leave();
    }
    await ctx.reply('Select an item to move:', telegraf_1.Markup.inlineKeyboard(buttons));
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('mov_')) {
        const data = ctx.callbackQuery.data.split('_');
        const sIdx = parseInt(data[1], 10);
        const iIdx = parseInt(data[2], 10);
        const sections = yamlAdmin_1.yamlAdmin.getSections();
        const sectionName = sections[sIdx]?.name;
        const title = sections[sIdx]?.items?.[iIdx]?.title;
        if (!sectionName || !title) {
            await ctx.answerCbQuery('Item not found.', { show_alert: true });
            await (0, cleanup_1.cleanupBotMessages)(ctx);
            return ctx.scene.leave();
        }
        ctx.wizard.state.sectionName = sectionName;
        ctx.wizard.state.itemTitle = title;
        await ctx.answerCbQuery();
        const sectionsRemaining = yamlAdmin_1.yamlAdmin.getSections().filter(s => s.name !== sectionName);
        const buttons = sectionsRemaining.map(s => {
            const idx = yamlAdmin_1.yamlAdmin.getSections().findIndex(x => x.name === s.name);
            return telegraf_1.Markup.button.callback(s.name, `dest_${idx}`);
        });
        if (!buttons.length)
            buttons.push(telegraf_1.Markup.button.callback('Create Unsorted', 'dest_unsorted'));
        await ctx.reply(`Move "${title}" to which section?`, telegraf_1.Markup.inlineKeyboard(buttons, { columns: 2 }));
        return ctx.wizard.next();
    }
}, async (ctx) => {
    if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('dest_')) {
        const destVal = ctx.callbackQuery.data.replace('dest_', '');
        let destSection = 'Unsorted';
        if (destVal !== 'unsorted') {
            const idx = parseInt(destVal, 10);
            destSection = yamlAdmin_1.yamlAdmin.getSections()[idx]?.name || 'Unsorted';
        }
        const { sectionName, itemTitle } = ctx.wizard.state;
        await ctx.answerCbQuery();
        const success = yamlAdmin_1.yamlAdmin.moveItems([itemTitle], sectionName, destSection);
        await (0, cleanup_1.cleanupBotMessages)(ctx);
        if (success) {
            await ctx.reply(`✅ Item "${itemTitle}" successfully moved to "${destSection}".`);
        }
        else {
            await ctx.reply(`❌ Failed to move item.`);
        }
        return ctx.scene.leave();
    }
});
exports.stage = new telegraf_1.Scenes.Stage([exports.addItemScene, exports.addSectionScene, exports.editItemScene, exports.manageSectionScene, exports.moveItemScene]);
// codded by https://github.com/dominatos
