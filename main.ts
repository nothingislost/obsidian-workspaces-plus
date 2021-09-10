import { Plugin, WorkspacePluginInstance, setIcon, Workspaces, Notice } from "obsidian";
import { WorkspacePickerSettings, WorkspacePickerSettingsTab } from "./settings";
import WorkspacePickerPluginModal from "workspace-picker-modal";
import { deepEqual } from "fast-equals";

export default class WorkspacePicker extends Plugin {
  settings: WorkspacePickerSettings;
  workspacePlugin: WorkspacePluginInstance;
  changeWorkspaceButton: HTMLElement;

  async onload() {
    // load settings
    this.settings = (await this.loadData()) || new WorkspacePickerSettings();

    // add the settings tab
    this.addSettingTab(new WorkspacePickerSettingsTab(this.app, this));
    
    this.workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;

    setTimeout(() => { // TODO: dirty hack to delay load and make sure our icon is always in the bottom right
      const workspacePickerStatusBarItem = this.addStatusBarItem();
      workspacePickerStatusBarItem.addClass('mod-clickable')
      const icon = workspacePickerStatusBarItem.createSpan("status-bar-item-segment icon mod-clickable");
      setIcon(icon, "pane-layout"); //pane-layout
  
      this.changeWorkspaceButton = workspacePickerStatusBarItem.createSpan({
        cls: "status-bar-item-segment name",
        text: this.workspacePlugin.activeWorkspace + (this.isWorkspaceModified() ? "*" : ""),
        prepend: false,
      });
      workspacePickerStatusBarItem.addEventListener("click", (evt) => {
        if (evt.shiftKey === true) {
          this.workspacePlugin.saveWorkspace(this.workspacePlugin.activeWorkspace);
          new Notice("Successfully saved workspace.")
          return;
        }
        new WorkspacePickerPluginModal(this.app, this.settings).open();
      });
    }, 100);

    this.registerEvent(this.app.workspace.on("layout-change", this.updateWorkspaceName));

    this.registerEvent(this.app.workspace.on("resize", this.updateWorkspaceName));



    this.addCommand({
      id: "open-workspace-picker",
      name: "Open Workspace Picker",
      callback: () => new WorkspacePickerPluginModal(this.app, this.settings).open(),
    });
  }

  updateWorkspaceName = () => {
    setTimeout(() => {
      this.changeWorkspaceButton.setText(this.workspacePlugin.activeWorkspace + (this.isWorkspaceModified() ? "*" : ""));
    }, 100);
  };

  isWorkspaceModified = () => {
    try { // this is to catch an on-resize related error when loading a new workspace
      var currentWorkspace = JSON.parse(JSON.stringify(this.app.workspace.getLayout()))
    } catch {
      return false;
    } // remove the active property since we don't need it for comparison
    var activeWorkspaceName = this.workspacePlugin.activeWorkspace, // active workspace name
    savedWorkspace = JSON.parse(JSON.stringify(this.workspacePlugin.workspaces[activeWorkspaceName]))
    deleteProp(savedWorkspace, ["active", "dimension", "width"]);
    deleteProp(currentWorkspace, ["active", "dimension", "width"]);
    return !deepEqual(currentWorkspace, savedWorkspace); // via the fast-equals package
  };
}

function deleteProp(obj: Workspaces, matches: string | string[]) {
  if (typeof matches === "string") matches = [matches];
  matches.forEach(match => {
    delete obj[match];
    for (let v of Object.values(obj)) {
      if (v instanceof Object) {
        deleteProp(v, match);
      }
    }
  });
}
