import { Plugin, WorkspacePluginInstance, setIcon, Notice, debounce } from "obsidian";
import { WorkspacesPlusSettings, WorkspacesPlusSettingsTab, DEFAULT_SETTINGS } from "./settings";
import { WorkspacesPlusPluginModal } from "./modal";
import { around } from "monkey-around";

export default class WorkspacesPlus extends Plugin {
  settings: WorkspacesPlusSettings;
  workspacePlugin: WorkspacePluginInstance;
  changeWorkspaceButton: HTMLElement;

  async onload() {
    // load settings
    await this.loadSettings();

    this.workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;

    this.installWorkspaceHooks();

    // add the settings tab
    this.addSettingTab(new WorkspacesPlusSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      setTimeout(() => {
        this.registerWorkspaceHotkeys();
        this.addStatusBarIndicator.apply(this);
      }, 100);
    });

    this.registerEvent(this.app.workspace.on("workspace-delete", (name: string) => this.onWorkspaceDelete(name)));
    this.registerEvent(
      this.app.workspace.on("workspace-rename", (name: string, oldName: string) =>
        this.onWorkspaceRename(name, oldName)
      )
    );
    this.registerEvent(this.app.workspace.on("workspace-save", (name: string) => this.onWorkspaceSave(name)));
    this.registerEvent(this.app.workspace.on("workspace-load", (name: string) => this.setWorkspaceName()));

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
    () => {
      this.workspacePlugin.saveWorkspace(this.workspacePlugin.activeWorkspace);
    },
    2000,
    true
  );

  onLayoutChange = () => {
    if (this.settings.saveOnChange) {
      this.debouncedSave();
    }
  };

  onWorkspaceRename(name: string, oldName: string) {
    this.setWorkspaceName();
    // remove the old command
    (this.app as any).commands.removeCommand(oldName);
    const hotkeys = (this.app as any).hotkeyManager.getHotkeys(oldName);
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
    if (!cMenuPlugin || cMenuItemIdx === -1) return
    let cMenuItems = cMenuPlugin.settings.menuCommands;
    cMenuItems[cMenuItemIdx].id = `workspaces-plus:${name}`;
    cMenuItems[cMenuItemIdx].name = `Workspaces Plus: Load Workspace: ${name}`;
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

  onWorkspaceSave(workspaceName: string) {
    this.setWorkspaceName();
    this.registerWorkspaceHotkeys();
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
    this.register(
      around(this.workspacePlugin, {
        saveWorkspace(old) {
          return async function saveWorkspace(workspaceName, ...etc) {
            const result = await old.call(this, workspaceName, ...etc);
            await this.app.workspace.trigger("workspace-save", workspaceName);
            return result;
          };
        },
        deleteWorkspace(old) {
          return async function deleteWorkspace(workspaceName, ...etc) {
            const result = await old.call(this, workspaceName, ...etc);
            await this.app.workspace.trigger("workspace-delete", workspaceName);
            return result;
          };
        },
        loadWorkspace(old) {
          return async function loadWorkspace(workspaceName, ...etc) {
            const result = await old.call(this, workspaceName, ...etc);
            await this.app.workspace.trigger("workspace-load", workspaceName);
            return result;
          };
        },
      })
    );
  }
}
