"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.yamlAdmin = exports.YamlAdmin = void 0;
const fs_1 = __importDefault(require("fs"));
const yaml_1 = __importDefault(require("yaml"));
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
        return config?.sections || [];
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
