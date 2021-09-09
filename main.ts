import { Plugin, WorkspacePluginInstance, setIcon } from "obsidian";
import { WorkspacePickerSettings, WorkspacePickerSettingsTab } from "./settings";
import WorkspacePickerPluginModal from "workspace-picker-modal";
import { deepEqual } from "fast-equals";

export default class WorkspacePicker extends Plugin {
  settings: WorkspacePickerSettings;
  workspacePlugin: WorkspacePluginInstance;
  changeWorkspaceButton: HTMLElement

  async onload() {
    // load settings
    this.settings = (await this.loadData()) || new WorkspacePickerSettings();

    // add the settings tab
    this.addSettingTab(new WorkspacePickerSettingsTab(this.app, this));

    const workspacePickerStatusBarItem = this.addStatusBarItem();
    this.workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;

    const icon = workspacePickerStatusBarItem.createDiv("icon");
    setIcon(icon, "pane-layout"); //pane-layout

    this.changeWorkspaceButton = workspacePickerStatusBarItem.createDiv({
      cls: "status-bar-item mod-clickable",
      text: this.workspacePlugin.activeWorkspace + (this.isWorkspaceModified() ? "*" : ""),
      prepend: false,
    });

    this.registerEvent(
      this.app.workspace.on("layout-change", this.updateWorkspaceName)
    );

    this.registerEvent(
        this.app.workspace.on("resize", this.updateWorkspaceName)
    );

    this.changeWorkspaceButton.addEventListener("click", () => {
      new WorkspacePickerPluginModal(this.app, this.settings).open();
    });

    this.addCommand({
      id: "open-workspace-picker",
      name: "Open Workspace Picker",
      callback: () => new WorkspacePickerPluginModal(this.app, this.settings).open(),
    });
  }

  updateWorkspaceName = () => {
    this.changeWorkspaceButton.setText(this.workspacePlugin.activeWorkspace + (this.isWorkspaceModified() ? "*" : ""));
  }

  isWorkspaceModified = () =>  {
    try { var { active, ...currentWorkspace } = this.app.workspace.getLayout(); } catch { return false } // remove the active property since we don't need it for comparison
    var activeWorkspaceName = this.workspacePlugin.activeWorkspace, // active workspace name
      { active, ...savedWorkspace } = this.workspacePlugin.workspaces[activeWorkspaceName];
    return !deepEqual(currentWorkspace, savedWorkspace); // via the fast-equals package
  }

}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
