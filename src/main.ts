import { Plugin, WorkspacePluginInstance, setIcon, Workspaces, Notice, debounce } from "obsidian";
import { WorkspacesPlusSettings, WorkspacesPlusSettingsTab } from "./settings";
import { WorkspacesPlusPluginModal } from "./modal";

export default class WorkspacesPlus extends Plugin {
  settings: WorkspacesPlusSettings;
  workspacePlugin: WorkspacePluginInstance;
  changeWorkspaceButton: HTMLElement;

  async onload() {
    // load settings
    this.settings = (await this.loadData()) || new WorkspacesPlusSettings();

    // temporary logic to transition the save on switch setting to save on change
    if (this.settings.saveOnSwitch && this.settings.saveOnChange === undefined) {
      this.settings.saveOnChange = true;
      this.saveData(this.settings);
    }

    // add the settings tab
    this.addSettingTab(new WorkspacesPlusSettingsTab(this.app, this));

    this.workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;

    this.app.workspace.onLayoutReady(() => {
      setTimeout(() => {
        this.addStatusBarIndicator.apply(this);
      }, 100);
    });

    this.registerEvent(this.app.workspace.on("layout-change", this.onLayoutChange));
    this.registerEvent(this.app.workspace.on("resize", this.onLayoutChange));

    this.addCommand({
      id: "open-workspaces-plus",
      name: "Open Workspaces Plus",
      callback: () => new WorkspacesPlusPluginModal(this.app, this.settings, true).open(),
    });
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
      new Notice("Successfully saved workspace.");
      return;
    }
    // otherwise, open the modal
    new WorkspacesPlusPluginModal(this.app, this.settings).open();
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
    this.setWorkspaceName();
    if (this.settings.saveOnChange) {
      this.debouncedSave();
    }
  };
}
