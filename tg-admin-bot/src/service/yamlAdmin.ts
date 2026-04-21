import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import crypto from 'crypto';
import { env } from '../config';
import { logger } from '../utils/logger';

export interface DashySubItem {
  title: string;
  url: string;
  icon?: string;
  target?: string;
}

export interface DashyItem {
  id?: string;
  title: string;
  description?: string;
  icon?: string;
  url?: string;
  target?: string;
  subItems?: DashySubItem[];
  [key: string]: any;
}

export interface DashySection {
  name: string;
  icon?: string;
  items?: DashyItem[];
  [key: string]: any;
}

export interface DashyConfig {
  sections?: DashySection[];
  [key: string]: any;
}

export class YamlAdmin {
  private confPath: string;

  constructor(filePath: string = env.CONF_PATH) {
    this.confPath = filePath;
  }

  public readConfig(): DashyConfig | null {
    try {
      if (!fs.existsSync(this.confPath)) {
        logger.warn(`Config file not found at ${this.confPath}`);
        return null;
      }
      const raw = fs.readFileSync(this.confPath, 'utf8');
      const doc = YAML.parse(raw);
      return doc || {};
    } catch (e) {
      logger.error({ err: e }, "Failed to read or parse YAML config");
      return null;
    }
  }

  public writeConfig(updatedConfig: DashyConfig): boolean {
    const tmpPath = `${this.confPath}.tmp`;
    try {
      const doc = new YAML.Document(updatedConfig);
      const raw = String(doc);
      
      // Atomic write using a temp file and copyFileSync to preserve docker mounts
      fs.writeFileSync(tmpPath, raw, 'utf8');
      fs.copyFileSync(tmpPath, this.confPath);
      fs.unlinkSync(tmpPath);
      
      logger.info("Successfully updated conf.yml");
      return true;
    } catch (e) {
      logger.error({ err: e }, "Failed to write config atomically");
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      }
      return false;
    }
  }

  public getSections(): DashySection[] {
    const config = this.readConfig();
    if (!config) return [];
    
    let modified = false;
    config.sections?.forEach(s => {
      s.items?.forEach(i => {
        if (!i.id) {
          i.id = crypto.randomBytes(4).toString('hex');
          modified = true;
        }
      });
    });
    
    if (modified) {
      this.writeConfig(config);
    }
    
    return config.sections || [];
  }

  public getSection(sectionName: string): DashySection | undefined {
    return this.getSections().find(s => s.name === sectionName);
  }

  public addItem(sectionName: string, item: DashyItem): boolean {
    const config = this.readConfig();
    if (!config) return false;

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
      item.id = crypto.randomBytes(4).toString('hex');
    }

    section.items.push(item);
    return this.writeConfig(config);
  }

  public editItem(sectionName: string, oldItemTitle: string, updatedItem: DashyItem): boolean {
    const config = this.readConfig();
    if (!config || !config.sections) return false;

    const section = config.sections.find(s => s.name === sectionName);
    if (!section || !section.items) return false;

    const index = section.items.findIndex(i => i.title === oldItemTitle);
    if (index === -1) return false;

    section.items[index] = { ...section.items[index], ...updatedItem };
    return this.writeConfig(config);
  }

  public deleteItem(sectionName: string, itemTitle: string): boolean {
    const config = this.readConfig();
    if (!config || !config.sections) return false;

    const section = config.sections.find(s => s.name === sectionName);
    if (!section || !section.items) return false;

    const initialLength = section.items.length;
    section.items = section.items.filter(i => i.title !== itemTitle);

    if (section.items.length === initialLength) return false; // not found
    
    return this.writeConfig(config);
  }

  public getItemById(id: string): { section: DashySection, item: DashyItem } | null {
    const config = this.readConfig();
    if (!config || !config.sections) return null;

    for (const section of config.sections) {
      if (section.items) {
        const item = section.items.find(i => i.id === id);
        if (item) return { section, item };
      }
    }
    return null;
  }

  public deleteItemById(id: string): boolean {
    const config = this.readConfig();
    if (!config || !config.sections) return false;

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

    if (!found) return false;
    return this.writeConfig(config);
  }

  public addSection(name: string, icon?: string): boolean {
    const config = this.readConfig();
    if (!config) return false;
    if (!config.sections) config.sections = [];
    
    if (config.sections.find(s => s.name === name)) return false; // exists

    config.sections.push({ name, icon, items: [] });
    return this.writeConfig(config);
  }

  public editSection(oldName: string, newName: string, newIcon?: string): boolean {
    if (oldName === 'Unsorted' && newName !== 'Unsorted') return false; // Unsorted is protected

    const config = this.readConfig();
    if (!config || !config.sections) return false;

    if (oldName !== newName && config.sections.some(s => s.name === newName)) {
      return false; // Cannot rename to an existing section name
    }

    const section = config.sections.find(s => s.name === oldName);
    if (!section) return false;

    section.name = newName;
    if (newIcon !== undefined) section.icon = newIcon;
    return this.writeConfig(config);
  }

  public deleteSection(name: string): boolean {
    if (name === 'Unsorted') return false; // Protected section 

    const config = this.readConfig();
    if (!config || !config.sections) return false;

    const initialLength = config.sections.length;
    config.sections = config.sections.filter(s => s.name !== name);

    if (config.sections.length === initialLength) return false;
    return this.writeConfig(config);
  }

  public moveItems(itemTitles: string[], fromSectionName: string, toSectionName: string): boolean {
    const config = this.readConfig();
    if (!config || !config.sections) return false;

    const fromSection = config.sections.find(s => s.name === fromSectionName);
    let toSection = config.sections.find(s => s.name === toSectionName);

    if (!fromSection || !fromSection.items) return false;

    // Auto-create destination section if needed
    if (!toSection) {
      toSection = { name: toSectionName, items: [] };
      config.sections.push(toSection);
    }
    if (!toSection.items) toSection.items = [];

    const itemsToMove = fromSection.items.filter(i => itemTitles.includes(i.title));
    if (itemsToMove.length === 0) return false;

    // Remove from old
    fromSection.items = fromSection.items.filter(i => !itemTitles.includes(i.title));
    
    // Add to new
    toSection.items.push(...itemsToMove);

    return this.writeConfig(config);
  }
}

export const yamlAdmin = new YamlAdmin();

// codded by https://github.com/dominatos
