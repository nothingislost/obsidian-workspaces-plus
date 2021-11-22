import { Plugin, WorkspacePluginInstance, setIcon, Notice, debounce } from "obsidian";
import { WorkspacesPlusSettings, WorkspacesPlusSettingsTab, DEFAULT_SETTINGS } from "./settings";
import { WorkspacesPlusPluginWorkspaceModal } from "./workspaceModal";
import { WorkspacesPlusPluginModeModal } from "./modeModal";
import { around } from "monkey-around";

const SETTINGS_ATTR = "workspaces-plus:settings-v1";

const workspacePlugin = (<any>window).app.internalPlugins.getPluginById("workspaces")
  .instance as WorkspacePluginInstance;

function getWorkspace(name: string) {
  return workspacePlugin.workspaces[name];
}

function getWorkspaceSettings(name: string) {
  const workspace = getWorkspace(name);
  if (!workspace) return null;
  return workspace[SETTINGS_ATTR] ? workspace[SETTINGS_ATTR] : (workspace[SETTINGS_ATTR] = {});
}

function getActiveModeName() {
  const settings = activeWorkspaceSettings();
  return settings?.mode;
}

function saveActiveMode() {
  getActiveModeName() && workspacePlugin.saveWorkspace(getActiveModeName());
}

function saveActiveWorkspace() {
  currentWorkspace() && workspacePlugin.saveWorkspace(currentWorkspace());
}

function getActiveModeDisplayName() {
  return getActiveModeName() ? getActiveModeName().replace(/^mode: /i, "") : "Global";
}

function setWorkspaceSettings(name: string, settings: any): any {
  const workspace = getWorkspace(name);
  workspace[SETTINGS_ATTR] = settings;
  return workspace[SETTINGS_ATTR];
}

function currentWorkspace() {
  return workspacePlugin.activeWorkspace;
}

function activeWorkspaceSettings() {
  return getWorkspaceSettings(currentWorkspace());
}

function isMode(name: string) {
  return name.match(/^mode:/i) ? true : false;
}

function getMode(name: string) {
  if (isMode(name)) return getWorkspace(name);
}

function getModeSettings(name: string) {
  if (isMode(name)) return getWorkspaceSettings(name);
}

function updateFoldState(settings: any) {
  if (settings.explorerFoldState)
    (<any>window).app.saveLocalStorage("file-explorer-unfold", settings.explorerFoldState);
}

function getDarkModeFromOS() {
  const isDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return isDarkMode ? "obsidian" : "moonstone";
}

function updateDarkModeFromOS(settings: any) {
  settings["theme"] = getDarkModeFromOS();
}

function loadMode(workspaceName: string, modeName: string) {
  const workspaceSettings = getWorkspaceSettings(workspaceName);
  const mode = getMode(modeName);
  const modeSettings = getModeSettings(modeName);
  // logic to allow for toggling a mode off/on
  if (workspaceSettings?.mode === modeName) {
    workspaceSettings.mode = null;
  } else {
    workspaceSettings.mode = modeName;
  }
  // load the mode's sidebar layouts, if enabled
  if (modeSettings?.saveSidebar) {
    mergeLayout(mode);
  } else {
    // TODO: load sidebar state from the current workspace? maintain global sidebar state?
  }
  this.saveData(); // call saveData on the workspace plugin to persist the workspace metadata to disk
  return true;
}

function mergeLayout(newLayout: any) {
  const workspace = (<any>window).app.workspace;
  const currentLayout = workspace.getLayout();
  newLayout["main"] = currentLayout["main"];
  workspace.changeLayout(newLayout);
}

export default class WorkspacesPlus extends Plugin {
  settings: WorkspacesPlusSettings;
  workspacePlugin: WorkspacePluginInstance;
  debug: boolean;
  workspaceLoading: boolean;
  statusBarWorkspace: HTMLElement;
  statusBarMode: HTMLElement;
  ribbonIconMode: HTMLElement;
  ribbonIconWorkspaces: HTMLElement;
  nativeWorkspaceRibbonItem: HTMLElement;

  async onload() {
    this.debug = true;
    // load settings
    await this.loadSettings();

    this.workspacePlugin = workspacePlugin;

    this.installWorkspaceHooks();

    // add the settings tab
    this.addSettingTab(new WorkspacesPlusSettingsTab(this.app, this));

    this.registerEventHandlers();
    this.registerCommands();

    this.app.workspace.onLayoutReady(() => {
      this.setPlatformWorkspace();
      // store current Obsidian settings into local plugin storage
      this.loadGlobalSettings();
      // store backups of workspaces.json and app.json
      // this.app.vault.writeConfigJson("workspaces-backup", {workspaces: this.app.internalPlugins.getPluginById("workspaces").instance.workspaces})
      // await this.app.vault.writeConfigJson("config-backup123", this.app.vault.config)
      setTimeout(() => {
        this.registerWorkspaceHotkeys();
        this.setWorkspaceAttribute();
        this.addStatusBarIndicator.apply(this);
        this.toggleModesFeature();
        if (this.settings.workspaceSwitcherRibbon) this.showWorkspaceRibbonButton();
        if (this.settings.workspaceSettings && this.settings.modeSwitcherRibbon) this.showModeRibbonButton();
      }, 100);
    });
  }

  onunload(): void {
    let combinedSettings = Object.assign({}, this.app.vault.config, this.settings.globalSettings);
    this.applySettings(combinedSettings);
    delete document.body.dataset.workspaceMode;
    delete document.body.dataset.workspaceName;
    if (this.settings.replaceNativeRibbon && this.nativeWorkspaceRibbonItem) {
      this.nativeWorkspaceRibbonItem.show();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  registerCommands() {
    this.addCommand({
      id: "open-workspaces-plus",
      name: "Open Workspaces Plus",
      callback: () => new WorkspacesPlusPluginWorkspaceModal(this, this.settings, true).open(),
    });
    this.addCommand({
      id: "save-workspace",
      name: `Save current workspace`,
      callback: () => {
        this.workspacePlugin.saveWorkspace(this.workspacePlugin.activeWorkspace);
        new Notice("Successfully saved workspace: " + this.workspacePlugin.activeWorkspace);
      },
    });
  }

  registerEventHandlers() {
    this.registerEvent(this.app.workspace.on("workspace-delete", this.onWorkspaceDelete));
    this.registerEvent(this.app.workspace.on("workspace-rename", this.onWorkspaceRename));
    this.registerEvent(this.app.workspace.on("workspace-save", this.onWorkspaceSave));
    this.registerEvent(this.app.workspace.on("workspace-load", this.onWorkspaceLoad));
    this.registerEvent(this.app.workspace.on("layout-change", this.onLayoutChange));
    this.registerEvent(this.app.workspace.on("resize", this.onLayoutChange));
  }

  get changeWorkspaceButton() {
    return this.statusBarWorkspace.querySelector(".status-bar-item-segment.name");
  }

  get changeModeButton() {
    return this.statusBarMode.querySelector(".status-bar-item-segment.name");
  }

  setPlatformWorkspace(): void {
    // note: don't call this too early in the init process or setActiveWorkspace will wipe all workspaces
    const _activeWorkspace = this.app.isMobile
      ? this.settings.activeWorkspaceMobile
      : this.settings.activeWorkspaceDesktop;
    if (_activeWorkspace) {
      this.workspacePlugin.setActiveWorkspace(_activeWorkspace);
    }
  }

  showWorkspaceRibbonButton(): void {
    if (this.settings.replaceNativeRibbon) {
      if (!this.nativeWorkspaceRibbonItem)
        this.nativeWorkspaceRibbonItem = document.body.querySelector('[aria-label="Manage workspaces"]');
      this.nativeWorkspaceRibbonItem.hide();
    }
    if (!this.ribbonIconWorkspaces) {
      this.ribbonIconWorkspaces = this.addRibbonIcon("pane-layout", "Manage workspaces", async () =>
        new WorkspacesPlusPluginWorkspaceModal(this, this.settings, true).open()
      );
    } else {
      this.ribbonIconWorkspaces.show();
    }
  }
  showModeRibbonButton(): void {
    if (!this.ribbonIconMode) {
      this.ribbonIconMode = this.addRibbonIcon("gear", "Manage modes", async () =>
        new WorkspacesPlusPluginModeModal(this, this.settings, true).open()
      );
    } else {
      this.ribbonIconMode.show();
    }
  }

  toggleModesFeature() {
    if (this.settings.workspaceSettings) {
      this.addStatusBarIndicator("mode");
      this.addCommand({
        id: "open-workspaces-plus-modes",
        name: "Open Workspaces Plus Modes",
        callback: () => new WorkspacesPlusPluginModeModal(this, this.settings, true).open(),
      });
      if (this.debug) console.log("toggle load", this.workspacePlugin.activeWorkspace);
      this.onWorkspaceLoad(this.workspacePlugin.activeWorkspace);
      this.registerEvent(this.app.vault.on("config-changed", this.onConfigChange));
    } else {
      this.app.vault.off("config-changed", this.onConfigChange);
      let combinedSettings = this.mergeGlobalSettings();
      this.applySettings(combinedSettings);
      this.statusBarMode?.detach();
      this.statusBarMode = null;
      (this.app as any).commands.removeCommand(`${this.manifest.id}:"open-workspaces-plus-modes"`);
    }
  }

  addStatusBarIndicator(modalType: string = "workspace") {
    let statusBarItem;
    const itemName = modalType == "mode" ? "statusBarMode" : "statusBarWorkspace";
    if (this[itemName]) return;
    else statusBarItem = this[itemName] = this.addStatusBarItem();

    statusBarItem.addClass(`${modalType}-switcher`);
    statusBarItem.setAttribute("aria-label", `Switch ${modalType}`);
    statusBarItem.setAttribute("aria-label-position", "top");
    // create the status bar icon
    const icon = statusBarItem.createSpan("status-bar-item-segment icon");
    modalType == "workspace" ? setIcon(icon, "pane-layout") : setIcon(icon, "gear"); // inject svg icon
    // create the status bar text
    let modeText = getActiveModeDisplayName();
    statusBarItem.createSpan({
      cls: "status-bar-item-segment name",
      text: modalType == "workspace" ? currentWorkspace() : modeText,
      prepend: false,
    });
    // register click handler
    statusBarItem.addEventListener("click", evt => this.onStatusBarClick(evt, modalType));
  }

  onStatusBarClick(evt: MouseEvent, modalType: string) {
    // handle the shift click to save current workspace shortcut
    if (evt.shiftKey === true) {
      modalType == "mode" ? saveActiveMode() : saveActiveWorkspace();
      // why trigger here?
      // this.app.workspace.trigger("layout-change");
      this.registerWorkspaceHotkeys();
      new Notice("Successfully saved " + (modalType == "mode" ? "mode" : "workspace"));
    } else {
      if (modalType === "workspace") new WorkspacesPlusPluginWorkspaceModal(this, this.settings).open();
      if (modalType === "mode") new WorkspacesPlusPluginModeModal(this, this.settings).open();
    }
  }

  setWorkspaceName = debounce(
    () => {
      this.changeWorkspaceButton?.setText(currentWorkspace());
      if (this.settings.workspaceSettings) this.changeModeButton?.setText(getActiveModeDisplayName());
    },
    100,
    true
  );

  debouncedSave = debounce(
    // avoid overly serializing the workspace during expensive operations like window resize
    (workspaceName: string) => {
      // avoid errors if the debounced save happens in the middle of a workspace switch
      if (workspaceName === currentWorkspace()) {
        if (this.debug) console.log("layout invoked save: " + workspaceName);
        this.workspacePlugin.saveWorkspace(workspaceName);
      } else {
        if (this.debug) console.log("skipped saving because the workspace has been changed");
      }
    },
    2000,
    true
  );

  onConfigChange = () => {
    if (!this.settings.workspaceSettings) return;
    if (this.workspaceLoading) {
      if (this.debug) console.log("skipped save due to recent workspace switch");
      return;
    }
    const activeModeName = getActiveModeName();
    if (activeModeName) {
      if (this.debug) console.log("config invoked mode update: " + activeModeName);
      this.workspacePlugin.saveWorkspace(activeModeName);
    } else {
      if (this.debug) console.log("config invoked global update");
      this.updateGlobalSettings();
    }
  };

  onLayoutChange = () => {
    if (!this.workspaceLoading) {
      // TODO: Handle per workspace auto save
      if (this.settings.saveOnChange) {
        this.debouncedSave(currentWorkspace());
      }
    }
  };

  setWorkspaceAttribute() {
    const workspace = currentWorkspace();
    document.body.dataset.workspaceName = workspace;
    if (this.settings.workspaceSettings) {
      const modeName = getActiveModeDisplayName();
      if (modeName) document.body.dataset.workspaceMode = modeName;
    }
  }

  onWorkspaceRename = (name: string, oldName: string) => {
    this.setWorkspaceName();
    // remove the old command
    (this.app as any).commands.removeCommand(`${this.manifest.id}:${oldName}`);
    const hotkeys = (this.app as any).hotkeyManager.getHotkeys(`${this.manifest.id}:${oldName}`);
    // register the new command
    this.registerWorkspaceHotkeys();
    if (hotkeys) {
      // reassign any hotkeys that were assigned to the old command
      (this.app as any).hotkeyManager.setHotkeys(this.manifest.id + ":" + name, hotkeys);
    }
    // update any cMenu buttons that were associated to the old command
    this.updateCMenuIcon(name, oldName);
    // persist changes to disk
    this.workspacePlugin.saveData();
  };

  updateCMenuIcon(name: string, oldName: string) {
    const cMenuPlugin = this.app.plugins.plugins["cmenu-plugin"];
    let cMenuItemIdx = cMenuPlugin?.settings.menuCommands.findIndex(cmd => cmd.id === `${this.manifest.id}:${oldName}`);
    if (!cMenuPlugin || cMenuItemIdx === -1) return;
    let cMenuItems = cMenuPlugin.settings.menuCommands;
    cMenuItems[cMenuItemIdx].id = `${this.manifest.id}:${name}`;
    cMenuItems[cMenuItemIdx].name = `${this.manifest.name}: Load: ${name}`;
    cMenuPlugin.saveSettings();
    // rebuild the cMenu toolbar
    dispatchEvent(new Event("cMenu-NewCommand"));
  }

  onWorkspaceDelete = (workspaceName: string) => {
    this.setWorkspaceName();
    const id = this.manifest.id + ":" + workspaceName;
    (this.app as any).commands.removeCommand(id);
    const hotkeys = (this.app as any).hotkeyManager.getHotkeys(id);
    if (hotkeys) {
      (this.app as any).hotkeyManager.removeHotkeys(this.manifest.id + ":" + workspaceName, hotkeys);
    }
  };

  onWorkspaceSave = async (workspaceName: string, customSettings: any) => {
    this.setWorkspaceName();
    this.registerWorkspaceHotkeys();
    if (!this.settings.workspaceSettings) return;
    if (!customSettings) {
      customSettings = getWorkspaceSettings(workspaceName);
    } else {
      customSettings = setWorkspaceSettings(workspaceName, customSettings);
    }
    if (isMode(workspaceName)) {
      customSettings.app = this.app.vault.config;
    } else {
      let explorerFoldState = await this.app.loadLocalStorage("file-explorer-unfold");
      if (explorerFoldState) customSettings.explorerFoldState = explorerFoldState;
    }
    this.workspacePlugin.saveData();
  };

  updatePlatformWorkspace(name: string) {
    if (this.app.isMobile) {
      this.settings.activeWorkspaceMobile = name;
    } else {
      this.settings.activeWorkspaceDesktop = name;
    }
  }

  mergeModeSettings(settings: any) {
    return Object.assign({}, this.app.vault.config, settings["app"]);
  }

  mergeGlobalSettings() {
    return Object.assign({}, this.app.vault.config, this.settings.globalSettings);
  }

  onWorkspaceLoad = (name: string) => {
    this.setWorkspaceName(); // sets status bar text
    this.setWorkspaceAttribute(); // sets HTML data attribute
    this.updatePlatformWorkspace(name);
    if (this.settings.workspaceSettings) {
      const settings = getWorkspaceSettings(name);
      const modeName = settings?.mode;
      const mode = modeName && getModeSettings(modeName);
      let combinedSettings;
      updateFoldState(settings);
      if (mode) {
        combinedSettings = this.mergeModeSettings(mode);
        if (this.debug) console.log("loading mode settings", mode, combinedSettings);
      } else if (settings) {
        combinedSettings = this.mergeGlobalSettings();
        if (this.debug) console.log("loading default settings", combinedSettings);
        settings["mode"] = null;
      } else {
        return;
      }
      if (this.settings.systemDarkMode) updateDarkModeFromOS(combinedSettings);
      // TODO: Fix initial app start reloading when global is set to disabled and mode is set to enabled
      this.needsReload(combinedSettings) && this.reloadIfNeeded();
      this.applySettings(combinedSettings);
    }
    this.saveData(this.settings);
  };

  needsReload(settings: any) {
    return this.settings.reloadLivePreview && settings.livePreview != (this.app.vault.config as any).livePreview;
  }

  reloadIfNeeded = debounce(() => {
    // this is currently the only way to tell if CM6 is actually loaded on desktop
    const isLoaded = (this.app as any).commands.editorCommands["editor:toggle-source"] ? true : false;
    const isEnabled = (this.app.vault.config as any).livePreview;
    if (isEnabled != isLoaded) window.location.reload();
  }, 1000);

  applySettings(settings: any) {
    // this emulates what Obsidian does when loading the core settings
    this.app.vault.config = settings;
    this.app.vault.saveConfig();
    this.app.workspace.updateOptions();
    this.app.setTheme(settings["theme"] as string);
    this.app.customCss.setTheme(settings["cssTheme"]);
    this.app.changeBaseFontSize(this.app.vault.getConfig("baseFontSize") as number);
    this.app.customCss.loadData();
    this.app.customCss.applyCss();
  }

  registerWorkspaceHotkeys() {
    const workspaceNames = Object.keys(this.workspacePlugin.workspaces);
    for (const workspaceName of workspaceNames) {
      this.addCommand({
        id: workspaceName,
        name: `Load: ${workspaceName}`,
        callback: () => {
          this.workspacePlugin.loadWorkspace(workspaceName);
        },
      });
    }
  }

  setLoadingStatus(): void {
    this.workspaceLoading = true;
    setTimeout(() => {
      this.workspaceLoading = false;
    }, 2000);
  }

  updateGlobalSettings(): void {
    this.settings.globalSettings = Object.assign({}, this.settings.globalSettings, this.app.vault.config);
    this.saveData(this.settings);
  }

  loadGlobalSettings() {
    if (Object.keys(this.settings.globalSettings).length === 0) {
      this.settings.globalSettings = this.app.vault.config;
      this.saveData(this.settings);
    }
    return this.settings.globalSettings;
  }

  installWorkspaceHooks() {
    // patch the internal workspaces plugin to emit events on save, delete, and load
    const plugin = this;
    this.register(
      around(this.workspacePlugin, {
        saveWorkspace(old) {
          return function saveWorkspace(workspaceName, ...etc) {
            if (!workspaceName) return;
            let settings;
            if (plugin.settings.workspaceSettings) {
              settings = getWorkspaceSettings(workspaceName);
            }
            const result = old.call(this, workspaceName, ...etc);
            if (plugin.debug) console.log("workspace saved: " + workspaceName);
            this.app.workspace.trigger("workspace-save", workspaceName, settings);
            return result;
          };
        },
        deleteWorkspace(old) {
          return function deleteWorkspace(workspaceName, ...etc) {
            const result = old.call(this, workspaceName, ...etc);
            this.app.workspace.trigger("workspace-delete", workspaceName);
            return result;
          };
        },
        loadWorkspace(old) {
          return function loadWorkspace(workspaceName, ...etc) {
            plugin.setLoadingStatus();
            let result;
            if (plugin.settings.workspaceSettings && isMode(workspaceName)) {
              // if the workspace being loaded is a mode, invoke the mode loader
              let modeName = workspaceName;
              workspaceName = currentWorkspace();
              result = loadMode.call(this, workspaceName, modeName);
            } else {
              result = old.call(this, workspaceName, ...etc);
            }
            this.app.workspace.trigger("workspace-load", workspaceName);
            return result;
          };
        },
      })
    );
  }
}
