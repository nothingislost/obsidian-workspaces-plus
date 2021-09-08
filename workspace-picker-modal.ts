import { App, FuzzySuggestModal, WorkspacePluginInstance } from "obsidian";

declare module "obsidian" {
  export interface FuzzySuggestModal<T> {
    chooser: Chooser<T>;
  }
  export interface Chooser<T> {
    setSelectedItem(selectedIdx: number): void;
    useSelectedItem(evt: MouseEvent | KeyboardEvent): void;
    values: { [x: string]: { item: any } };
    selectedItem: number;
    chooser: Chooser<T>;
    updateSuggestions(): void;
    suggestions: { scrollIntoViewIfNeeded: () => void }[];
  }
  export interface App {
    internalPlugins: InternalPlugins;
    viewRegistry: ViewRegistry;
  }

  export interface InstalledPlugin {
    enabled: boolean;
    instance: PluginInstance;
  }

  export interface InternalPlugins {
    plugins: Record<string, InstalledPlugin>;
    getPluginById(id: string): InstalledPlugin;
  }

  export interface ViewRegistry {
    viewByType: Record<string, unknown>;
    isExtensionRegistered(extension: string): boolean;
  }

  export interface PluginInstance {
    id: string;
    name: string;
    description: string;
  }

  export interface WorkspacePluginInstance extends PluginInstance {
    deleteWorkspace(workspaceName: string): void;
    saveWorkspace(workspaceName: string): void;
    loadWorkspace(workspaceName: string): void;
    activeWorkspace: string;
    workspaces: {};
  }
}

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
    this.scope.register(["Shift"], "Enter", evt => this.useSelectedItem(evt));
    this.scope.register(["Alt"], "Enter", evt => this.useSelectedItem(evt));
  }

  workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;
  activeWorkspace: string;

  onOpen() {
    super.onOpen();
    this.activeWorkspace = this.workspacePlugin.activeWorkspace;
    let selectedIdx = this.getItems().findIndex(workspace => workspace === this.activeWorkspace);
    this.chooser.setSelectedItem(selectedIdx);
    this.chooser.suggestions[this.chooser.selectedItem].scrollIntoViewIfNeeded();
  }

  onClose() {
    super.onClose();
    this.app.workspace.trigger("layout-change");
  }

  useSelectedItem = function(evt: MouseEvent | KeyboardEvent) {
    let workspaceName = this.inputEl.value ? this.inputEl.value : null;
    if (!this.values && workspaceName && evt.shiftKey) {
      this.saveAndStay();
      this.setWorkspace(workspaceName);
      this.close();
      return !1;
    }
    else if (!this.values)
      return !1;
    var item = this.values ? this.values[this.selectedItem] : workspaceName;
    return void 0 !== item && (this.chooser.selectSuggestion(item, evt),
      !0)
  }

  saveAndStay() {
    let workspaceName = this.inputEl.value ? this.inputEl.value : this.chooser.values[this.chooser.selectedItem].item;
    console.log('save as: ' + workspaceName)
    this.workspacePlugin.saveWorkspace(workspaceName);
  }

  saveAndSwitch() {
    this.workspacePlugin.saveWorkspace(this.activeWorkspace);
  }

  deleteWorkspace() {
    let currentSelection = this.chooser.selectedItem
    let workspaceName = this.chooser.values[currentSelection].item;
    this.workspacePlugin.deleteWorkspace(workspaceName);
    this.chooser.chooser.updateSuggestions();
    this.chooser.setSelectedItem(currentSelection-1);
  }

  getItems(): any[] {
    return [...Object.keys(this.workspacePlugin.workspaces)];
  }

  getItemText(item: any): string {
    return item;
  }

  onChooseItem(item: any, evt: MouseEvent | KeyboardEvent): void {
    console.log("choose")
    let modifiers: string;

    if (evt.shiftKey && !evt.altKey) modifiers = "Shift";
    else if (evt.altKey && !evt.shiftKey) modifiers = "Alt";
    else modifiers = "";

    if (modifiers === "Shift") this.saveAndStay(), this.setWorkspace(item), this.close();
    if (modifiers === "Alt") this.saveAndSwitch(), this.setWorkspace(item);
    else this.setWorkspace(item);

    // this.app.workspace.trigger("layout-change");
  }

  setWorkspace(workspaceName: string) {
    this.workspacePlugin.loadWorkspace(workspaceName);
  }
}
