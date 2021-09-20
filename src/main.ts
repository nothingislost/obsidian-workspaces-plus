import { Plugin, WorkspacePluginInstance, setIcon, Workspaces, Notice } from "obsidian";
import { WorkspacesPlusSettings, WorkspacesPlusSettingsTab } from "./settings";
import { WorkspacesPlusPluginModal } from "./modal";
import { deepEqual } from "fast-equals";

export default class WorkspacesPlus extends Plugin {
  settings: WorkspacesPlusSettings;
  workspacePlugin: WorkspacePluginInstance;
  changeWorkspaceButton: HTMLElement;

  async onload() {
    // load settings
    this.settings = (await this.loadData()) || new WorkspacesPlusSettings();

    // add the settings tab
    this.addSettingTab(new WorkspacesPlusSettingsTab(this.app, this));

    this.workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;

    setTimeout(() => {
      // TODO: dirty hack to delay load and make sure our icon is always in the bottom right
      const WorkspacesPlusStatusBarItem = this.addStatusBarItem();
      WorkspacesPlusStatusBarItem.addClass("mod-clickable");
      WorkspacesPlusStatusBarItem.ariaLabel = "Switch workspaces"
      WorkspacesPlusStatusBarItem.setAttribute("aria-label-position", "top");
      // WorkspacesPlusStatusBarItem.ariaLa = "Workspace Picker"
      const icon = WorkspacesPlusStatusBarItem.createSpan("status-bar-item-segment icon mod-clickable");
      setIcon(icon, "pane-layout"); //pane-layout

      this.changeWorkspaceButton = WorkspacesPlusStatusBarItem.createSpan({
        cls: "status-bar-item-segment name",
        text: this.workspacePlugin.activeWorkspace + (this.isWorkspaceModified() ? "*" : ""),
        prepend: false,
      });
      WorkspacesPlusStatusBarItem.addEventListener("click", evt => {
        if (evt.shiftKey === true) {
          this.workspacePlugin.saveWorkspace(this.workspacePlugin.activeWorkspace);
          this.app.workspace.trigger("layout-change");
          new Notice("Successfully saved workspace.");
          return;
        }
        new WorkspacesPlusPluginModal(this.app, this.settings).open();
      });
    }, 100);

    this.registerEvent(this.app.workspace.on("layout-change", this.updateWorkspaceName));

    this.registerEvent(this.app.workspace.on("resize", this.updateWorkspaceName));

    this.addCommand({
      id: "open-workspaces-plus",
      name: "Open Workspaces Plus",
      callback: () => new WorkspacesPlusPluginModal(this.app, this.settings, true).open(),
    });
  }

  updateWorkspaceName = () => {
    setTimeout(() => {
      this.changeWorkspaceButton.setText(
        this.workspacePlugin.activeWorkspace + (this.isWorkspaceModified() ? "*" : "")
      );
    }, 100);
  };

  isWorkspaceModified = () => {
    if (!this.settings.showModification) return false;
    try {
      // this is to catch an on-resize related error when loading a new workspace
      var currentWorkspace = JSON.parse(JSON.stringify(this.app.workspace.getLayout()));
    } catch {
      return false;
    } // remove the active property since we don't need it for comparison
    var activeWorkspaceName = this.workspacePlugin.activeWorkspace; // active workspace name
    if (!Object.keys(this.workspacePlugin.workspaces).includes(activeWorkspaceName)) return true;
    var savedWorkspace = JSON.parse(JSON.stringify(this.workspacePlugin.workspaces[activeWorkspaceName]));
    deleteProp(savedWorkspace, ["active", "dimension", "width", "pane-relief:history-v1", "eState"]);
    deleteProp(currentWorkspace, ["active", "dimension", "width", "pane-relief:history-v1", "eState"]);
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
