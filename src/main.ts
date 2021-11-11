// workspace metadata saving: work in progress

import { Plugin, WorkspacePluginInstance, setIcon, Notice, debounce } from "obsidian";
import { WorkspacesPlusSettings, WorkspacesPlusSettingsTab, DEFAULT_SETTINGS } from "./settings";
import { WorkspacesPlusPluginModal } from "./modal";
import { around } from "monkey-around";

export default class WorkspacesPlus extends Plugin {
  settings: WorkspacesPlusSettings;
  workspacePlugin: WorkspacePluginInstance;
  changeWorkspaceButton: HTMLElement;
  debug: boolean;
  workspaceLoading: boolean;

  async onload() {
    this.debug = false;
    // load settings
    await this.loadSettings();

    this.workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;

    this.installWorkspaceHooks();

    // add the settings tab
    this.addSettingTab(new WorkspacesPlusSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      setTimeout(() => {
        this.registerWorkspaceHotkeys();
        this.setWorkspaceAttribute();
        this.addStatusBarIndicator.apply(this);
      }, 100);
    });

    this.registerEvent(this.app.workspace.on("workspace-delete", (name: string) => this.onWorkspaceDelete(name)));
    this.registerEvent(
      this.app.workspace.on("workspace-rename", (name: string, oldName: string) =>
        this.onWorkspaceRename(name, oldName)
      )
    );

    this.registerEvent(this.app.vault.on("config-changed", () => this.onConfigChange()));
    this.registerEvent(this.app.workspace.on("workspace-save", (name: string) => this.onWorkspaceSave(name)));
    this.registerEvent(this.app.workspace.on("workspace-load", (name: string) => this.onWorkspaceLoad(name)));

    this.registerEvent(this.app.workspace.on("layout-change", this.onLayoutChange));
    this.registerEvent(this.app.workspace.on("resize", this.onLayoutChange));

    this.addCommand({
      id: "open-workspaces-plus",
      name: "Open Workspaces Plus",
      callback: () => new WorkspacesPlusPluginModal(this, this.settings, true).open(),
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  addStatusBarIndicator() {
    const statusBarItem = this.addStatusBarItem();
    statusBarItem.addClass("mod-clickable");
    statusBarItem.setAttribute("aria-label", "Switch workspaces");
    statusBarItem.setAttribute("aria-label-position", "top");
    // create the status bar icon
    const icon = statusBarItem.createSpan("status-bar-item-segment icon");
    setIcon(icon, "pane-layout"); // inject svg icon
    // create the status bar text
    this.changeWorkspaceButton = statusBarItem.createSpan({
      cls: "status-bar-item-segment name",
      text: this.workspacePlugin.activeWorkspace,
      prepend: false,
    });
    // register click handler
    statusBarItem.addEventListener("click", evt => this.onStatusBarClick(evt));
  }

  onStatusBarClick(evt: MouseEvent) {
    // handle the shift click to save current workspace shortcut
    if (evt.shiftKey === true) {
      this.workspacePlugin.saveWorkspace(this.workspacePlugin.activeWorkspace);
      this.app.workspace.trigger("layout-change");
      this.registerWorkspaceHotkeys();
      new Notice("Successfully saved workspace.");
      return;
    }
    // otherwise, open the modal
    new WorkspacesPlusPluginModal(this, this.settings).open();
  }

  setWorkspaceName = debounce(
    () => this.changeWorkspaceButton?.setText(this.workspacePlugin.activeWorkspace),
    100,
    true
  );

  debouncedSave = debounce(
    // avoid overly serializing the workspace during expensive operations like window resize
    (workspaceName: string) => {
      // avoid errors if the debounced save happens in the middle of a workspace switch
      if (workspaceName === this.workspacePlugin.activeWorkspace) {
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
    if (!this.settings.saveOnChange) return;
    if (!this.workspaceLoading) {
      const currentWorkspace = this.workspacePlugin.activeWorkspace;
      if (this.debug) console.log("config invoked save: " + this.workspacePlugin.activeWorkspace);
      setTimeout(() => {
        if (currentWorkspace === this.workspacePlugin.activeWorkspace)
          this.workspacePlugin.saveWorkspace(currentWorkspace);
      }, 2000); // wait for app settings to be saved before saving workspace
    } else {
      if (this.debug) console.log("skipped save due to recent workspace switch");
    }
  };

  onLayoutChange = () => {
    if (!this.workspaceLoading) {
      // console.log("pre debounce workspace name: " + this.workspacePlugin.activeWorkspace);
      if (this.settings.saveOnChange) {
        this.debouncedSave(this.workspacePlugin.activeWorkspace);
      }
    }
  };

  setWorkspaceAttribute() {
    document.body.dataset.workspaceName = this.workspacePlugin.activeWorkspace;
  }

  onWorkspaceRename(name: string, oldName: string) {
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
  }

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

  onWorkspaceDelete(workspaceName: string) {
    this.setWorkspaceName();
    const id = this.manifest.id + ":" + workspaceName;
    (this.app as any).commands.removeCommand(id);
    const hotkeys = (this.app as any).hotkeyManager.getHotkeys(id);
    if (hotkeys) {
      (this.app as any).hotkeyManager.removeHotkeys(this.manifest.id + ":" + workspaceName, hotkeys);
    }
  }

  async onWorkspaceSave(workspaceName: string) {
    this.setWorkspaceName();
    this.registerWorkspaceHotkeys();
    if (this.settings.workspaceSettings) {
      let settings = this.workspacePlugin.workspaces[workspaceName];
      let explorerFoldState = this.app.loadLocalStorage("file-explorer-unfold");
      const appSettings = await this.app.vault.readConfigJson("app");
      const appearanceSettings = await this.app.vault.readConfigJson("appearance");
      if (
        !explorerFoldState &&
        settings["workspaces-plus:settings-v1"] &&
        settings["workspaces-plus:settings-v1"]["explorerFoldState"]
      )
        explorerFoldState = [...settings["workspaces-plus:settings-v1"]["explorerFoldState"]];
      settings["workspaces-plus:settings-v1"] = {
        app: appSettings,
        appearance: appearanceSettings,
        explorerFoldState: explorerFoldState,
      };
    }
  }

  onWorkspaceLoad(name: string) {
    this.setWorkspaceName(); // sets status bar text
    this.setWorkspaceAttribute(); // sets HTML data attribute
    if (this.settings.workspaceSettings) {
      const settings = this.workspacePlugin.workspaces[name]["workspaces-plus:settings-v1"];
      let combinedSettings;
      if (settings) {
        if (settings["explorerFoldState"])
          this.app.saveLocalStorage("file-explorer-unfold", settings["explorerFoldState"]);
        combinedSettings = Object.assign({}, settings["app"], settings["appearance"]);
        this.app.vault.config = combinedSettings;
        this.app.vault.saveConfig();
        this.app.workspace.updateOptions();
        this.app.setTheme(this.app.vault.getConfig("theme") as string);
        this.app.changeBaseFontSize(this.app.vault.getConfig("baseFontSize") as number);
        this.app.customCss.loadData();
        this.app.customCss.applyCss();
      }
    }
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

  installWorkspaceHooks() {
    // patch the internal workspaces plugin to emit events on save, delete, and load
    const plugin = this;
    this.register(
      around(this.workspacePlugin, {
        saveWorkspace(old) {
          return function saveWorkspace(workspaceName, ...etc) {
            if (this.debug) console.log("workspace saved: " + workspaceName);
            const result = old.call(this, workspaceName, ...etc);
            this.app.workspace.trigger("workspace-save", workspaceName);
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
            if (/^mode:/i.test(workspaceName)) {
              if (plugin.debug) console.log("mode loader: " + workspaceName);
              const currentLayout = this.app.workspace.getLayout();
              const newLayout = plugin.workspacePlugin.workspaces[workspaceName];
              newLayout["main"] = currentLayout["main"];
              this.app.workspace.changeLayout(newLayout);
              // note: modes do not change this.app.workspace.activeWorkspace
              this.saveData();
              this.app.workspace.trigger("workspace-load", workspaceName);
              return;
            }
            plugin.workspaceLoading = true;
            setTimeout(() => {
              plugin.workspaceLoading = false;
            }, 2500);
            const result = old.call(this, workspaceName, ...etc);
            this.app.workspace.trigger("workspace-load", workspaceName);
            return result;
          };
        },
      })
    );
    this.register(
      around(this.app, {
        // this is so we can save the workspace on file explorer fold state change
        saveLocalStorage(old) {
          return function saveLocalStorage(e, t, ...etc) {
            try {
              plugin.onConfigChange();
            } catch {}
            return old.call(this, e, t, ...etc);
          };
        },
      })
    );
  }
}
