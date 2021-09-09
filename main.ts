import { Plugin, WorkspacePluginInstance, setIcon } from "obsidian";
import { WorkspacePickerSettings, WorkspacePickerSettingsTab } from "./settings";
import WorkspacePickerPluginModal from "workspace-picker-modal";


export default class WorkspacePicker extends Plugin {
  settings: WorkspacePickerSettings;

  async onload() {
    // load settings
    this.settings = (await this.loadData()) || new WorkspacePickerSettings();

    // add the settings tab
    this.addSettingTab(new WorkspacePickerSettingsTab(this.app, this));

    const workspacePickerStatusBarItem = this.addStatusBarItem();
    const workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;

    const icon = workspacePickerStatusBarItem.createDiv('icon')
    setIcon(icon, 'pane-layout'); //pane-layout

    const changeWorkspaceButton: HTMLElement = workspacePickerStatusBarItem.createDiv({
      cls: "status-bar-item mod-clickable",
      text: workspacePlugin.activeWorkspace,
      prepend: false
    });

    this.app.workspace.on("layout-change", () =>
      changeWorkspaceButton.setText(workspacePlugin.activeWorkspace)
    );

    changeWorkspaceButton.addEventListener("click", () => {
      new WorkspacePickerPluginModal(this.app, this.settings).open();
    });

    this.addCommand({
      id: "open-workspace-picker",
      name: "Open Workspace Picker",
      callback: () => new WorkspacePickerPluginModal(this.app, this.settings).open(),
    });
  }
}
