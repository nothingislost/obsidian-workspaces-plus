import { App, FuzzySuggestModal, KeymapEventListener } from "obsidian";

export default class WorkspacePickerPluginModal extends FuzzySuggestModal<string> {
  constructor(app: App) {
    super(app);

    //@ts-ignore
    this.bgEl.setAttribute("style", "background-color: transparent");
    this.modalEl.classList.add("workspace-picker-modal");

    this.setPlaceholder("Type workspace name...");
    this.setInstructions([
      {
        command: "↵",
        purpose: "switch",
      },
      {
        command: "Shift ↵",
        purpose: "save and return",
      },
      {
        command: "Alt ↵",
        purpose: "save and switch",
      },
      {
        command: "Shift ⌫",
        purpose: "delete (no prompt)",
      },
      {
        command: "esc",
        purpose: "cancel",
      },
    ]);
    this.scope.register(["Shift"], "Delete", this.deleteWorkspace.bind(this));
    this.scope.register(["Shift"], "Enter", item => this.chooser.useSelectedItem(item));
    this.scope.register(["Alt"], "Enter", item => this.chooser.useSelectedItem(item));
  }

  workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance;

  saveAndStay() {
    let workspaceName = this.inputEl.value ? this.inputEl.value : this.chooser.values[this.chooser.selectedItem].item;
    this.workspacePlugin.saveWorkspace(workspaceName);
  }

  saveAndSwitch() {
    this.workspacePlugin.saveWorkspace(this.activeWorkspace);
  }

  deleteWorkspace() {
    let workspaceName = this.chooser.values[this.chooser.selectedItem].item;
    this.workspacePlugin.deleteWorkspace(workspaceName);
    this.chooser.chooser.updateSuggestions();
  }

  onOpen() {
    super.onOpen();
    this.activeWorkspace = this.workspacePlugin.activeWorkspace;
    //@ts-ignore
    let selectedIdx = this.getItems().findIndex(workspace => workspace === this.activeWorkspace);
    this.chooser.setSelectedItem(selectedIdx);
    //@ts-ignore
    this.chooser.suggestions[this.chooser.selectedItem].scrollIntoViewIfNeeded();
  }

  onClose() {
    super.onClose();
  }

  getItems(): any[] {
    //@ts-ignore
    return [...Object.keys(window.app.internalPlugins.getPluginById("workspaces").instance.workspaces)];
  }

  getItemText(item: any): string {
    return item;
  }

  onChooseItem(item: any, evt: MouseEvent | KeyboardEvent): void {
    let modifiers: string;

    if (evt.shiftKey && !evt.altKey) {
      modifiers = "Shift";
    } else if (evt.altKey && !evt.shiftKey) {
      modifiers = "Alt";
    } else {
      modifiers = "";
    }
    if (modifiers === "Shift") this.saveAndStay(), this.setWorkspace(item), this.close();
    if (modifiers === "Alt") {
      this.saveAndSwitch(), this.setWorkspace(item);
    } else this.setWorkspace(item);
    this.app.workspace.trigger("layout-change");
  }

  setWorkspace(workspaceName: string) {
    //@ts-ignore
    this.workspacePlugin.loadWorkspace(workspaceName);
  }
}
