import { Plugin, WorkspacePluginInstance } from "obsidian";
import WorkspacePickerPluginModal from "workspace-picker-modal";

export default class WorkspacePicker extends Plugin {
  async onload() {
    const workspacePickerStatusBarItem: HTMLElement = this.addStatusBarItem();
    const workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;

    const changeWorkspaceButton: HTMLElement = workspacePickerStatusBarItem.createDiv({
      cls: "status-bar-item mod-clickable",
      text: "workspace: " + workspacePlugin.activeWorkspace,
    });

    this.app.workspace.on("layout-change", () =>
      changeWorkspaceButton.setText("workspace: " + workspacePlugin.activeWorkspace)
    );

    changeWorkspaceButton.addEventListener("click", () => {
      new WorkspacePickerPluginModal(this.app).open();
    });

    this.addCommand({
      id: "open-workspace-picker",
      name: "Open Workspace Picker",
      callback: () => new WorkspacePickerPluginModal(this.app).open(),
    });
  }
}
