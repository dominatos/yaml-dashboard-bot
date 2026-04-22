"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.yamlAdmin = exports.YamlAdmin = void 0;
const fs_1 = __importDefault(require("fs"));
const yaml_1 = __importDefault(require("yaml"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class YamlAdmin {
    confPath;
    constructor(filePath = config_1.env.CONF_PATH) {
        this.confPath = filePath;
    }
    readConfig() {
        try {
            if (!fs_1.default.existsSync(this.confPath)) {
                logger_1.logger.warn(`Config file not found at ${this.confPath}`);
                return null;
            }
            const raw = fs_1.default.readFileSync(this.confPath, 'utf8');
            const doc = yaml_1.default.parse(raw);
            return doc || {};
        }
        catch (e) {
            logger_1.logger.error({ err: e }, "Failed to read or parse YAML config");
            return null;
        }
    }
    writeConfig(updatedConfig) {
        const tmpPath = `${this.confPath}.tmp`;
        try {
            const doc = new yaml_1.default.Document(updatedConfig);
            const raw = String(doc);
            // Atomic write using a temp file and copyFileSync to preserve docker mounts
            fs_1.default.writeFileSync(tmpPath, raw, 'utf8');
            fs_1.default.copyFileSync(tmpPath, this.confPath);
            fs_1.default.unlinkSync(tmpPath);
            logger_1.logger.info("Successfully updated conf.yml");
            return true;
        }
        catch (e) {
            logger_1.logger.error({ err: e }, "Failed to write config atomically");
            if (fs_1.default.existsSync(tmpPath)) {
                try {
                    fs_1.default.unlinkSync(tmpPath);
                }
                catch (_) { }
            }
            return false;
        }
    }
    getSections() {
        const config = this.readConfig();
        if (!config)
            return [];
        let modified = false;
        config.sections?.forEach(s => {
            s.items?.forEach(i => {
                if (!i.id) {
                    i.id = crypto_1.default.randomBytes(4).toString('hex');
                    modified = true;
                }
            });
        });
        if (modified) {
            this.writeConfig(config);
        }
        return config.sections || [];
    }
    getSection(sectionName) {
        return this.getSections().find(s => s.name === sectionName);
    }
    addItem(sectionName, item) {
        const config = this.readConfig();
        if (!config)
            return false;
        if (!config.sections) {
            config.sections = [];
        }
        let section = config.sections.find(s => s.name === sectionName);
        if (!section) {
            // Create new section automatically
            section = { name: sectionName, items: [] };
            config.sections.push(section);
        }
        if (!section.items) {
            section.items = [];
        }
        if (!item.id) {
            item.id = crypto_1.default.randomBytes(4).toString('hex');
        }
        section.items.push(item);
        return this.writeConfig(config);
    }
    editItem(sectionName, oldItemTitle, updatedItem) {
        const config = this.readConfig();
        if (!config || !config.sections)
            return false;
        const section = config.sections.find(s => s.name === sectionName);
        if (!section || !section.items)
            return false;
        const index = section.items.findIndex(i => i.title === oldItemTitle);
        if (index === -1)
            return false;
        section.items[index] = { ...section.items[index], ...updatedItem };
        return this.writeConfig(config);
    }
    deleteItem(sectionName, itemTitle) {
        const config = this.readConfig();
        if (!config || !config.sections)
            return false;
        const section = config.sections.find(s => s.name === sectionName);
        if (!section || !section.items)
            return false;
        const initialLength = section.items.length;
        section.items = section.items.filter(i => i.title !== itemTitle);
        if (section.items.length === initialLength)
            return false; // not found
        return this.writeConfig(config);
    }
    getItemById(id) {
        const config = this.readConfig();
        if (!config || !config.sections)
            return null;
        for (const section of config.sections) {
            if (section.items) {
                const item = section.items.find(i => i.id === id);
                if (item)
                    return { section, item };
            }
        }
        return null;
    }
    deleteItemById(id) {
        const config = this.readConfig();
        if (!config || !config.sections)
            return false;
        let found = false;
        for (const section of config.sections) {
            if (section.items) {
                const initialLength = section.items.length;
                section.items = section.items.filter(i => i.id !== id);
                if (section.items.length < initialLength) {
                    found = true;
                    break;
                }
            }
        }
        if (!found)
            return false;
        return this.writeConfig(config);
    }
    addSection(name, icon) {
        const config = this.readConfig();
        if (!config)
            return false;
        if (!config.sections)
            config.sections = [];
        if (config.sections.find(s => s.name === name))
            return false; // exists
        config.sections.push({ name, icon, items: [] });
        return this.writeConfig(config);
    }
    editSection(oldName, newName, newIcon) {
        if (oldName === 'Unsorted' && newName !== 'Unsorted')
            return false; // Unsorted is protected
        const config = this.readConfig();
        if (!config || !config.sections)
            return false;
        if (oldName !== newName && config.sections.some(s => s.name === newName)) {
            return false; // Cannot rename to an existing section name
        }
        const section = config.sections.find(s => s.name === oldName);
        if (!section)
            return false;
        section.name = newName;
        if (newIcon !== undefined)
            section.icon = newIcon;
        return this.writeConfig(config);
    }
    deleteSection(name) {
        if (name === 'Unsorted')
            return false; // Protected section 
        const config = this.readConfig();
        if (!config || !config.sections)
            return false;
        const initialLength = config.sections.length;
        config.sections = config.sections.filter(s => s.name !== name);
        if (config.sections.length === initialLength)
            return false;
        return this.writeConfig(config);
    }
    // ----------------------------------------------------------------
    // NavLink methods
    // ----------------------------------------------------------------
    getNavLinks() {
        const config = this.readConfig();
        if (!config)
            return [];
        return config.pageInfo?.navLinks || [];
    }
    addNavLink(navLink) {
        const config = this.readConfig();
        if (!config)
            return false;
        if (!config.pageInfo)
            config.pageInfo = {};
        if (!Array.isArray(config.pageInfo.navLinks))
            config.pageInfo.navLinks = [];
        // Prevent duplicates by title
        const exists = config.pageInfo.navLinks.some((n) => n.title === navLink.title);
        if (exists)
            return false;
        config.pageInfo.navLinks.push(navLink);
        return this.writeConfig(config);
    }
    deleteNavLink(title) {
        const config = this.readConfig();
        if (!config || !config.pageInfo?.navLinks)
            return false;
        const initial = config.pageInfo.navLinks.length;
        config.pageInfo.navLinks = config.pageInfo.navLinks.filter((n) => n.title !== title);
        if (config.pageInfo.navLinks.length === initial)
            return false;
        return this.writeConfig(config);
    }
    // ----------------------------------------------------------------
    // SubItem methods
    // ----------------------------------------------------------------
    getSubItems(itemId) {
        const result = this.getItemById(itemId);
        if (!result)
            return [];
        return result.item.subItems || [];
    }
    /**
     * Add a subItem to an item identified by itemId.
     * Auto-convert: if the item has a `url` but no `subItems` yet,
     * promote the existing url into a subItem titled "Open" first,
     * so it is not silently lost from the PHP dashboard rendering.
     */
    addSubItem(itemId, subItem) {
        const config = this.readConfig();
        if (!config || !config.sections)
            return false;
        let targetItem;
        for (const section of config.sections) {
            if (section.items) {
                targetItem = section.items.find((i) => i.id === itemId);
                if (targetItem)
                    break;
            }
        }
        if (!targetItem)
            return false;
        // Auto-convert: promote existing url into first subItem
        if (!targetItem.subItems && targetItem.url) {
            targetItem.subItems = [
                { title: 'Open', url: targetItem.url }
            ];
        }
        if (!targetItem.subItems)
            targetItem.subItems = [];
        // Prevent duplicate sub-link titles
        const exists = targetItem.subItems.some((s) => s.title === subItem.title);
        if (exists)
            return false;
        targetItem.subItems.push(subItem);
        return this.writeConfig(config);
    }
    editSubItem(itemId, oldSubItemTitle, updatedSubItem) {
        const config = this.readConfig();
        if (!config || !config.sections)
            return false;
        let targetItem;
        for (const section of config.sections) {
            if (section.items) {
                targetItem = section.items.find((i) => i.id === itemId);
                if (targetItem)
                    break;
            }
        }
        if (!targetItem || !targetItem.subItems)
            return false;
        const subItemIndex = targetItem.subItems.findIndex((s) => s.title === oldSubItemTitle);
        if (subItemIndex === -1)
            return false;
        const nextTitle = updatedSubItem.title?.trim();
        if (nextTitle &&
            nextTitle !== oldSubItemTitle &&
            targetItem.subItems.some((s, idx) => idx !== subItemIndex && s.title === nextTitle)) {
            return false;
        }
        const currentSubItem = targetItem.subItems[subItemIndex];
        const mergedSubItem = { ...currentSubItem };
        if (Object.prototype.hasOwnProperty.call(updatedSubItem, 'title') && nextTitle) {
            mergedSubItem.title = nextTitle;
        }
        if (Object.prototype.hasOwnProperty.call(updatedSubItem, 'url') && updatedSubItem.url?.trim()) {
            mergedSubItem.url = updatedSubItem.url.trim();
        }
        if (Object.prototype.hasOwnProperty.call(updatedSubItem, 'icon')) {
            if (updatedSubItem.icon?.trim()) {
                mergedSubItem.icon = updatedSubItem.icon.trim();
            }
            else {
                delete mergedSubItem.icon;
            }
        }
        if (Object.prototype.hasOwnProperty.call(updatedSubItem, 'target')) {
            if (updatedSubItem.target?.trim()) {
                mergedSubItem.target = updatedSubItem.target.trim();
            }
            else {
                delete mergedSubItem.target;
            }
        }
        targetItem.subItems[subItemIndex] = mergedSubItem;
        return this.writeConfig(config);
    }
    deleteSubItem(itemId, subItemTitle) {
        const config = this.readConfig();
        if (!config || !config.sections)
            return false;
        let targetItem;
        for (const section of config.sections) {
            if (section.items) {
                targetItem = section.items.find((i) => i.id === itemId);
                if (targetItem)
                    break;
            }
        }
        if (!targetItem || !targetItem.subItems)
            return false;
        const initial = targetItem.subItems.length;
        targetItem.subItems = targetItem.subItems.filter((s) => s.title !== subItemTitle);
        if (targetItem.subItems.length === initial)
            return false;
        // If all subItems removed, clean up the empty array
        if (targetItem.subItems.length === 0) {
            delete targetItem.subItems;
        }
        return this.writeConfig(config);
    }
    moveItems(itemTitles, fromSectionName, toSectionName) {
        const config = this.readConfig();
        if (!config || !config.sections)
            return false;
        const fromSection = config.sections.find(s => s.name === fromSectionName);
        let toSection = config.sections.find(s => s.name === toSectionName);
        if (!fromSection || !fromSection.items)
            return false;
        // Auto-create destination section if needed
        if (!toSection) {
            toSection = { name: toSectionName, items: [] };
            config.sections.push(toSection);
        }
        if (!toSection.items)
            toSection.items = [];
        const itemsToMove = fromSection.items.filter(i => itemTitles.includes(i.title));
        if (itemsToMove.length === 0)
            return false;
        // Remove from old
        fromSection.items = fromSection.items.filter(i => !itemTitles.includes(i.title));
        // Add to new
        toSection.items.push(...itemsToMove);
        return this.writeConfig(config);
    }
}
exports.YamlAdmin = YamlAdmin;
exports.yamlAdmin = new YamlAdmin();
// codded by https://github.com/dominatos
