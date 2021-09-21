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
        // TODO: dirty hack to delay load and make sure our icon is always in the bottom right
        const statusBarItem = this.addStatusBarItem();
        statusBarItem.addClass("mod-clickable");
        statusBarItem.ariaLabel = "Switch workspaces";
        statusBarItem.setAttribute("aria-label-position", "top");
        const icon = statusBarItem.createSpan("status-bar-item-segment icon mod-clickable");
        setIcon(icon, "pane-layout"); //pane-layout

        this.changeWorkspaceButton = statusBarItem.createSpan({
          cls: "status-bar-item-segment name",
          text: this.workspacePlugin.activeWorkspace,
          prepend: false,
        });
        statusBarItem.addEventListener("click", evt => {
          if (evt.shiftKey === true) {
            this.workspacePlugin.saveWorkspace(this.workspacePlugin.activeWorkspace);
            this.app.workspace.trigger("layout-change");
            new Notice("Successfully saved workspace.");
            return;
          }
          new WorkspacesPlusPluginModal(this.app, this.settings).open();
        });
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
}
