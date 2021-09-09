import { App, Modal, FuzzySuggestModal, WorkspacePluginInstance } from "obsidian";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";
import { WorkspacePickerSettings, WorkspacePickerSettingsTab } from "./settings";


declare module "obsidian" {
  export interface FuzzySuggestModal<T> {
    chooser: Chooser<T>;
    suggestEl: HTMLDivElement;
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
    workspaces: { [x: string]: { [x: string]: any; active: any; }; }; // TODO: fix this inferred typing
  }
}

interface IConfirmationDialogParams {
  cta: string;
  // eslint-disable-next-line
  onAccept: (...args: any[]) => Promise<void>;
  text: string;
  title: string;
}

export class ConfirmationModal extends Modal {
  constructor(app: App, config: IConfirmationDialogParams) {
    super(app);
    this.modalEl.addClass("workspace-delete-confirm-modal");
    const { cta, onAccept, text, title } = config;

    this.contentEl.createEl("h3", { text: title });

    let e: HTMLParagraphElement = this.contentEl.createEl("p", { text });
    e.id = "workspace-delete-confirm-dialog";

    this.contentEl.createDiv("modal-button-container", buttonsEl => {
      buttonsEl.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());

      const btnSumbit = buttonsEl.createEl("button", {
        attr: { type: "submit" },
        cls: "mod-cta",
        text: cta,
      });
      btnSumbit.addEventListener("click", async e => {
        await onAccept();
        this.close();
      });
      setTimeout(() => {
        btnSumbit.focus();
      }, 50);
    });
  }
}

export function createConfirmationDialog({ cta, onAccept, text, title }: IConfirmationDialogParams): void {
  // @ts-ignore
  new ConfirmationModal(window.app, { cta, onAccept, text, title }).open();
}

export default class WorkspacePickerPluginModal extends FuzzySuggestModal<string> {
  workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;
  activeWorkspace: string;
  popper: PopperInstance;
  settings: WorkspacePickerSettings;
  showInstructions: boolean = false;
  emptyStateText: string = "No match found. Use Shift ↵ to save as...";

  constructor(app: App, settings: WorkspacePickerSettings) {
    super(app);
    this.settings = settings;

    //@ts-ignore
    this.bgEl.setAttribute("style", "background-color: transparent");
    this.modalEl.classList.add("workspace-picker-modal");

    this.setPlaceholder("Type workspace name...");
    if (settings.showInstructions) {
      this.setInstructions([
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
          purpose: "delete",
        },
        {
          command: "esc",
          purpose: "cancel",
        },
      ]);
    }
    this.scope.register(["Shift"], "Delete", this.deleteWorkspace.bind(this));
    this.scope.register(["Shift"], "Enter", evt => this.useSelectedItem(evt));
    this.scope.register(["Alt"], "Enter", evt => this.useSelectedItem(evt));
  }

  open = () => {
    (<any>this.app).keymap.pushScope(this.scope);
    document.body.appendChild(this.containerEl);
    this.popper = createPopper(document.body.querySelector(".plugin-workspace-picker"), this.modalEl, {
      placement: "top-start",
      modifiers: [{ name: "offset", options: { offset: [0, 10] } }],
    });
    this.onOpen();
  };

  onOpen() {
    super.onOpen();
    this.activeWorkspace = this.workspacePlugin.activeWorkspace;
    let selectedIdx = this.getItems().findIndex(workspace => workspace === this.activeWorkspace);
    this.chooser.setSelectedItem(selectedIdx);
    this.chooser.suggestions[this.chooser.selectedItem].scrollIntoViewIfNeeded();
    document.body
      .querySelector(".workspace-picker-modal>.prompt-input")
      .addEventListener("input", () => this.popper.update());
  }

  onClose() {
    super.onClose();
    this.app.workspace.trigger("layout-change");
  }

  useSelectedItem = function (evt: MouseEvent | KeyboardEvent) {
    let workspaceName = this.inputEl.value ? this.inputEl.value : this.chooser.values[this.chooser.selectedItem].item;
    if (!this.values && workspaceName && evt.shiftKey) {
      this.saveAndStay();
      this.setWorkspace(workspaceName);
      this.close();
      return !1;
    } else if (!this.chooser.values) return !1;
    var item = this.chooser.values ? this.chooser.values[this.chooser.selectedItem] : workspaceName;
    return void 0 !== item && (this.selectSuggestion(item, evt), !0);
  };

  saveAndStay() {
    let workspaceName = this.inputEl.value ? this.inputEl.value : this.chooser.values[this.chooser.selectedItem].item;
    this.workspacePlugin.saveWorkspace(workspaceName);
  }

  saveAndSwitch() {
    this.workspacePlugin.saveWorkspace(this.activeWorkspace);
  }

  deleteWorkspace() {
    let currentSelection = this.chooser.selectedItem;
    let workspaceName = this.chooser.values[currentSelection].item;
    if (this.settings.showDeletePrompt) {
      const confirmEl = createConfirmationDialog({
        cta: "Delete",
        onAccept: async () => {
          this.doDelete(workspaceName);
        },
        text: `Do you really want to delete the '` + workspaceName + `' workspace?`,
        title: "Workspace Delete Confirmation",
      });
    } else {
      this.doDelete(workspaceName);
    }
    // this.popper = createPopper(
    //   document.body.querySelector(".plugin-workspace-picker"),
    //   document.body.querySelector(".workspace-delete-confirm-modal"),
    //   {
    //     placement: "top",
    //     modifiers: [{ name: "offset", options: { offset: [0, 10] } }],
    //   }
    // );
  }

  doDelete(workspaceName: string) {
    let currentSelection = this.chooser.selectedItem;
    this.workspacePlugin.deleteWorkspace(workspaceName);
    this.chooser.chooser.updateSuggestions();
    this.chooser.setSelectedItem(currentSelection - 1);
  }

  getItems(): any[] {
    return [...Object.keys(this.workspacePlugin.workspaces)];
  }

  getItemText(item: any): string {
    return item;
  }

  onChooseItem(item: any, evt: MouseEvent | KeyboardEvent): void {
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
