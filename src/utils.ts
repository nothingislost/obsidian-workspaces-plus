import { settings } from "cluster";
// import type moment from "moment";
import type { Moment } from "moment";
import { WorkspacePluginInstance, App, normalizePath, TFile } from "obsidian";
import {
  IGranularity,
  getAllDailyNotes,
  getDailyNote,
  getDateFromPath,
  getWeeklyNote,
  getAllWeeklyNotes,
  getMonthlyNote,
  getAllMonthlyNotes,
  getQuarterlyNote,
  getAllQuarterlyNotes,
  getYearlyNote,
  getAllYearlyNotes,
  createDailyNote,
  createWeeklyNote,
  createMonthlyNote,
  createQuarterlyNote,
  createYearlyNote,
  getPeriodicNoteSettings,
} from "obsidian-daily-notes-interface";
import WorkspacesPlus from "./main";

function pathJoin(parts: string[], sep?: string) {
  const separator = sep || "/";
  parts = parts.map((part: string, index: number) => {
    if (index) {
      part = part.replace(new RegExp("^" + separator), "");
    }
    if (index !== parts.length - 1) {
      part = part.replace(new RegExp(separator + "$"), "");
    }
    return part;
  });
  return parts.join(separator);
}

export default class Utils {
  SETTINGS_ATTR = "workspaces-plus:settings-v1";
  workspacePlugin: WorkspacePluginInstance;
  app: App;
  plugin: WorkspacesPlus;

  constructor(plugin: WorkspacesPlus) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;
  }

  getWorkspace(name: string) {
    return this.workspacePlugin.workspaces[name];
  }

  getWorkspaceSettings(name: string) {
    const workspace = this.getWorkspace(name);
    if (!workspace) return null;
    return workspace[this.SETTINGS_ATTR] ? workspace[this.SETTINGS_ATTR] : (workspace[this.SETTINGS_ATTR] = {});
  }

  get activeModeName() {
    const settings = this.activeWorkspaceSettings();
    return settings?.mode;
  }

  saveActiveMode(): void {
    this.activeModeName && this.workspacePlugin.saveWorkspace(this.activeModeName);
  }

  saveActiveWorkspace() {
    this.activeWorkspace && this.workspacePlugin.saveWorkspace(this.activeWorkspace);
  }

  getActiveModeDisplayName() {
    return this.activeModeName ? this.activeModeName.replace(/^mode: /i, "") : "Global";
  }

  setWorkspaceSettings(name: string, settings: any): any {
    const workspace = this.getWorkspace(name);
    workspace[this.SETTINGS_ATTR] = settings;
    return workspace[this.SETTINGS_ATTR];
  }

  get activeWorkspace() {
    return this.workspacePlugin.activeWorkspace;
  }

  activeWorkspaceSettings() {
    return this.getWorkspaceSettings(this.activeWorkspace);
  }

  isMode(name: string) {
    return name.match(/^mode:/i) ? true : false;
  }

  get isNativePluginEnabled() {
    return this.workspacePlugin.plugin._loaded;
  }

  getMode(name: string) {
    if (this.isMode(name)) return this.getWorkspace(name);
  }

  loadMode(workspaceName: string, modeName: string) {
    const workspace = this.getWorkspace(workspaceName);
    const workspaceSettings = this.getWorkspaceSettings(workspaceName);
    const mode = this.getMode(modeName);
    const modeSettings = this.getModeSettings(modeName);
    // logic to allow for toggling a mode off/on
    if (workspaceSettings?.mode === modeName) {
      workspaceSettings.mode = null;
    } else {
      workspaceSettings && (workspaceSettings.mode = modeName);
    }
    // load the mode's sidebar layouts, if enabled
    if (modeSettings?.saveSidebar && workspaceSettings.mode) {
      mode && this.mergeSidebarLayout(mode);
      this.updateFoldState(modeSettings);
    } else {
      workspace && this.mergeSidebarLayout(workspace);
      this.updateFoldState(workspaceSettings);
    }
    this.workspacePlugin.saveData(); // call saveData on the workspace plugin to persist the workspace metadata to disk
    return true;
  }

  setChildId(split: any, leafId: string, fileName: string): boolean {
    let found = false;

    function recurse(split: any, leafId: string, fileName: string): boolean {
      if (found) return;
      if (split.type == "leaf") {
        if (split.id == leafId) {
          if (fileName) {
            split.state.state.file = fileName;
          } else {
            split.state.state.file = null;
          }
          found = true;
        }
      } else if (split.type == "split") {
        split.children.forEach((child: any) => {
          recurse(child, leafId, fileName);
        });
      }
    }

    recurse(split, leafId, fileName);
    return found;
  }

  createPeriodicNote(granularity: IGranularity, date: Moment): Promise<TFile> {
    const createFn = {
      day: createDailyNote,
      week: createWeeklyNote,
      month: createMonthlyNote,
      quarter: createQuarterlyNote,
      year: createYearlyNote,
    };
    return createFn[granularity](date);
  }

  async getPeriodicNoteFromPath(path: string): Promise<string> {
    const periods = {
      day: { get: getDailyNote, getAll: getAllDailyNotes },
      week: { get: getWeeklyNote, getAll: getAllWeeklyNotes },
      month: { get: getMonthlyNote, getAll: getAllMonthlyNotes },
      quarter: { get: getQuarterlyNote, getAll: getAllQuarterlyNotes },
      year: { get: getYearlyNote, getAll: getAllYearlyNotes },
    };
    const result = await Promise.all(
      Object.entries(periods).map(async entry => {
        const [granularity, action] = entry;
        const date = getDateFromPath(path, granularity);
        if (date) {
          const settings = getPeriodicNoteSettings(granularity);

          const resolvedPath = normalizePath(pathJoin([settings.folder, date?.format(settings.format) + ".md"]));
          // console.log(path, date, resolvedPath, settings, granularity);
          if (path == resolvedPath) {
            let dnp = action.get(date, action.getAll());
            if (dnp === null) dnp = await this.createPeriodicNote(granularity, date);
            return dnp.path;
          }
        }
      })
    );
    return result.find(filePath => filePath);
  }

  async applyFileOverrides(workspaceName: string, workspace: any): Promise<void> {
    let workspaceSettings = this.getWorkspaceSettings(workspaceName);
    if (workspaceSettings?.fileOverrides) {
      await Promise.all(
        Object.entries(workspaceSettings.fileOverrides).map(async (entry: string[]) => {
          let [leafId, fileName] = entry;
          let parsedFileName = this.renderTemplateString(fileName);

          await this.getPeriodicNoteFromPath(parsedFileName);
          const file = this.app.vault.getAbstractFileByPath(normalizePath(parsedFileName)) as TFile;
          // console.log("parsedFileName", parsedFileName, file);
          if (!file) {
            fileName = null;
          }
          const result = this.setChildId(workspace.main, leafId, file?.path);
          // console.log(workspace);
          if (!result) {
            // clean up any overrides for panes that no longer exist
            delete workspaceSettings.fileOverrides[leafId];
          }
        })
      );
    }
  }

  getModeSettings(name: string) {
    if (this.isMode(name)) return this.getWorkspaceSettings(name);
  }

  updateFoldState(settings: any) {
    if (settings?.explorerFoldState) this.app.saveLocalStorage("file-explorer-unfold", settings.explorerFoldState);
  }

  getDarkModeFromOS() {
    const isDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return isDarkMode ? "obsidian" : "moonstone";
  }

  updateDarkModeFromOS(settings: any) {
    settings["theme"] = this.getDarkModeFromOS();
  }

  mergeSidebarLayout(newLayout: any) {
    const workspace = this.app.workspace;
    const currentLayout = workspace.getLayout();
    newLayout["main"] = currentLayout["main"];
    workspace.changeLayout(newLayout);
  }

  // Template string rendering with math. Credit to Liam Cain https://github.com/liamcain/obsidian-daily-notes-interface
  renderTemplateString(text: string) {
    const templateOptions = (<any>window).app.internalPlugins.getPluginById("templates").instance.options;
    let dateFormat = (templateOptions && templateOptions.dateFormat) || "YYYY-MM-DD";
    let timeFormat = (templateOptions && templateOptions.timeFormat) || "HH:mm";
    const date = window.moment();
    return (text = text
      .replace(
        /{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi,
        (_: any, timeOrDate: string, calc: any, timeDelta: string, unit: any, momentFormat: string) => {
          let _format;
          let resolvedDate;
          const now = window.moment();
          if (timeOrDate == "time") {
            _format = timeFormat;
          } else {
            _format = dateFormat;
          }
          const currentDate = date.clone().set({
            hour: now.get("hour"),
            minute: now.get("minute"),
            second: now.get("second"),
          });
          if (calc) {
            currentDate.add(parseInt(timeDelta, 10), unit);
          }
          if (momentFormat) {
            resolvedDate = currentDate.format(momentFormat.substring(1).trim());
            // console.log("momentFormat", momentFormat.substring(1).trim(), resolvedDate);
          } else {
            resolvedDate = currentDate.format(_format);
          }
          return resolvedDate;
        }
      )
      .replace(/{{\s*yesterday\s*}}/gi, date.clone().subtract(1, "day").format(dateFormat))
      .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, "d").format(dateFormat)));
  }
}
