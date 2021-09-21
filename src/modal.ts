import { App, Modal, FuzzySuggestModal, WorkspacePluginInstance, FuzzyMatch, Notice, Scope } from "obsidian";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";
import { WorkspacesPlusSettings } from "./settings";

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
    setActiveWorkspace(workspaceName: string): void;
    activeWorkspace: string;

    workspaces: { [x: string]: Workspaces }; // TODO: fix this inferred typing
  }

  export interface Workspaces {
    [x: string]: any; // TODO: fix typing
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
  new ConfirmationModal(this.app, { cta, onAccept, text, title }).open();
}

export class WorkspacesPlusPluginModal extends FuzzySuggestModal<string> {
  workspacePlugin = this.app.internalPlugins.getPluginById("workspaces").instance as WorkspacePluginInstance;
  activeWorkspace: string;
  popper: PopperInstance;
  settings: WorkspacesPlusSettings;
  showInstructions: boolean = false;
  invokedViaHotkey: boolean;
  emptyStateText: string = "No match found. Use Shift ↵ to save as...";
  bgEl: HTMLElement;

  constructor(app: App, settings: WorkspacesPlusSettings, hotkey: boolean = false) {
    super(app);
    // Cloning as a hacky way to get rid of the default onInput handler so that
    // we can use our own onInput method
    const inputElClone = this.inputEl.cloneNode() as HTMLInputElement;
    this.modalEl.replaceChild(inputElClone, this.inputEl);
    this.inputEl = inputElClone;
    this.settings = settings;
    this.invokedViaHotkey = hotkey;
    this.bgEl.parentElement.setAttribute("style", "background-color: transparent !important");
    if (!this.invokedViaHotkey) {
      this.bgEl.setAttribute("style", "background-color: transparent");
      this.modalEl.classList.add("quick-switch");
    }
    this.modalEl.classList.add("workspaces-plus-modal");
    this.inputEl.addEventListener("input", this.onInputChanged.bind(this));
    this.resultContainerEl.on("click", ".workspace-item", this.onSuggestionClick.bind(this));
    this.resultContainerEl.on("mousemove", ".workspace-item", this.onSuggestionMouseover.bind(this));
    this.setPlaceholder("Type workspace name...");
    this.buildInstructions();
    this.scope = new Scope();
    this.scope.register([], "Escape", evt => this.onEscape(evt));
    this.scope.register([], "Enter", evt => this.useSelectedItem(evt));
    this.scope.register(["Shift"], "Delete", this.deleteWorkspace.bind(this));
    this.scope.register(["Ctrl"], "Enter", evt => this.onRenameClick(evt, null));
    this.scope.register(["Shift"], "Enter", evt => this.useSelectedItem(evt));
    this.scope.register(["Alt"], "Enter", evt => this.useSelectedItem(evt));
    this.scope.register([], "ArrowUp", evt => {
      if (!evt.isComposing)
        return (
          this.chooser.setSelectedItem(this.chooser.selectedItem - 1),
          !1,
          this.chooser.suggestions[this.chooser.selectedItem].scrollIntoViewIfNeeded()
        );
    });
    this.scope.register([], "ArrowDown", evt => {
      if (!evt.isComposing)
        return (
          this.chooser.setSelectedItem(this.chooser.selectedItem + 1),
          !1,
          this.chooser.suggestions[this.chooser.selectedItem].scrollIntoViewIfNeeded()
        );
    });
  }

  buildInstructions() {
    if (this.settings.showInstructions || this.invokedViaHotkey) {
      let instructions;
      if (!this.settings.saveOnChange) {
        instructions = [
          {
            command: "shift ↵",
            purpose: "save and return",
          },
          {
            command: "alt ↵",
            purpose: "save and switch",
          },
        ];
      } else {
        instructions = [
          {
            command: "↵",
            purpose: "switch",
          },
        ];
      }
      instructions.push(
        {
          command: "ctrl ↵",
          purpose: "rename",
        },
        {
          command: "shift ⌫",
          purpose: "delete",
        },
        {
          command: "esc",
          purpose: "cancel",
        }
      );
      this.setInstructions(instructions);
    }
  }

  onInputChanged(): void {
    this.chooser.chooser.updateSuggestions();
  }

  onEscape(evt: MouseEvent | KeyboardEvent) {
    const evtTargetEl = evt.target as HTMLElement;
    // if we're actively renaming a workspace, escape out of the rename
    if (evtTargetEl.classList.contains("workspace-item") && evtTargetEl.contentEditable === "true") {
      evtTargetEl.textContent = evtTargetEl.dataset.workspaceName;
      evtTargetEl.contentEditable = "false";
      return;
    }
    // otherwise, close the modal
    this.close();
  }

  onSuggestionClick = function (evt: MouseEvent | KeyboardEvent, itemEl: HTMLElement) {
    if (itemEl.contentEditable === "true") {
      evt.stopPropagation();
      return;
    }
    evt.preventDefault();
    let item = this.chooser.suggestions.indexOf(itemEl);
    this.chooser.setSelectedItem(item), this.useSelectedItem(evt);
  };

  onSuggestionMouseover = function (evt: MouseEvent | KeyboardEvent, itemEl: HTMLElement) {
    let item = this.chooser.suggestions.indexOf(itemEl);
    this.chooser.setSelectedItem(item);
  };

  open = () => {
    (<any>this.app).keymap.pushScope(this.scope);
    document.body.appendChild(this.containerEl);
    if (!this.invokedViaHotkey) {
      this.popper = createPopper(document.body.querySelector(".plugin-workspaces-plus"), this.modalEl, {
        placement: "top-start",
        modifiers: [{ name: "offset", options: { offset: [0, 10] } }],
      });
    }
    this.onOpen();
  };

  onOpen() {
    super.onOpen();
    this.activeWorkspace = this.workspacePlugin.activeWorkspace;
    let selectedIdx = this.getItems().findIndex(workspace => workspace === this.activeWorkspace);
    // let selectedIdx = 0; // default to the first item
    this.chooser.setSelectedItem(selectedIdx);
    this.chooser.suggestions[this.chooser.selectedItem]?.scrollIntoViewIfNeeded();
  }

  onClose() {
    (<any>this.app).keymap.popScope(this.scope);
    super.onClose();
    this.app.workspace.trigger("layout-change");
  }

  handleRename(targetEl: HTMLElement) {
    targetEl.parentElement.parentElement.removeClass("renaming");
    const originalName = targetEl.dataset.workspaceName;
    const newName = targetEl.textContent;
    this.workspacePlugin.deleteWorkspace(originalName);
    this.workspacePlugin.saveWorkspace(newName);
    if (originalName === this.activeWorkspace) {
      this.setWorkspace(newName);
      this.activeWorkspace = newName;
    }
    this.chooser.chooser.updateSuggestions();
    targetEl.contentEditable = "false";
    this.app.workspace.trigger("layout-change");
    let selectedIdx = this.getItems().findIndex((workspace: string) => workspace === newName);
    this.chooser.setSelectedItem(selectedIdx);
  }

  useSelectedItem = function (evt: MouseEvent | KeyboardEvent) {
    // @ts-ignore
    const targetEl = evt.path[0];
    if (targetEl.contentEditable === "true") {
      this.handleRename(targetEl);
      return;
    }
    let workspaceName = this.inputEl.value ? this.inputEl.value : this.chooser.values[this.chooser.selectedItem].item;
    if (!this.values && workspaceName && evt.shiftKey) {
      this.saveAndStay();
      this.setWorkspace(workspaceName);
      this.close();
      return !1;
    } else if (!this.chooser.values) return !1;
    let item = this.chooser.values ? this.chooser.values[this.chooser.selectedItem] : workspaceName;
    return void 0 !== item && (this.selectSuggestion(item, evt), !0);
  };

  saveAndStay() {
    let workspaceName = this.inputEl.value ? this.inputEl.value : this.chooser.values[this.chooser.selectedItem].item;
    this.workspacePlugin.saveWorkspace(workspaceName);
    new Notice("Successfully saved workspace: " + workspaceName);
  }

  saveAndSwitch() {
    this.workspacePlugin.saveWorkspace(this.activeWorkspace);
    new Notice("Successfully saved workspace: " + this.activeWorkspace);
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
  }

  renderSuggestion(item: FuzzyMatch<any>, el: HTMLElement) {
    super.renderSuggestion(item, el);
    const resultEl = document.body.querySelector("div.workspaces-plus-modal div.prompt-results");
    const existingEl = resultEl.querySelector('div[data-workspace-name="' + el.textContent + '"]');
    let newDiv;
    if (!existingEl) {
      newDiv = document.createElement("div");
      newDiv.addClass("workspace-results");
      el.dataset.workspaceName = el.textContent;
      el.removeClass("suggestion-item");
      el.addClass("workspace-item");
      if (el.textContent === this.workspacePlugin.activeWorkspace) {
        const activeIcon = newDiv.createDiv("active-workspace");
        activeIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"/></svg>`;
      }
      newDiv.appendChild(el);
      resultEl.appendChild(newDiv);
    } else {
      newDiv = existingEl;
    }
    const renameIcon = newDiv.createDiv("rename-workspace");
    renameIcon.ariaLabel = "Rename workspace";
    renameIcon.setAttribute("aria-label-position", "top");
    renameIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12.9 6.858l4.242 4.243L7.242 21H3v-4.243l9.9-9.9zm1.414-1.414l2.121-2.122a1 1 0 0 1 1.414 0l2.829 2.829a1 1 0 0 1 0 1.414l-2.122 2.121-4.242-4.242z"/></svg>`;
    renameIcon.addEventListener("click", event => this.onRenameClick(event, el));
    const deleteIcon = newDiv.createDiv("delete-workspace");
    deleteIcon.ariaLabel = "Delete workspace";
    deleteIcon.setAttribute("aria-label-position", "top");
    deleteIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M7 4V2h10v2h5v2h-2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6H2V4h5zM6 6v14h12V6H6zm3 3h2v8H9V9zm4 0h2v8h-2V9z"/></svg>`;
    deleteIcon.addEventListener("click", event => this.deleteWorkspace());
  }

  onRenameClick = function (evt: MouseEvent | KeyboardEvent, el: HTMLElement) {
    evt.stopPropagation();
    //@ts-ignore
    if (!el) el = this.chooser.suggestions[this.chooser.selectedItem];
    el.parentElement.parentElement.addClass("renaming");
    if (el.contentEditable === "true") {
      el.textContent = el.dataset.workspaceName;
      el.contentEditable = "false";
      return;
    } else {
      el.contentEditable = "true";
    }
    const selection = window.getSelection();
    const range = document.createRange();
    selection.removeAllRanges();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.addRange(range);
    el.focus();
    el.onblur = ev => {
      el.parentElement.parentElement.removeClass("renaming");
      el.contentEditable = "false";
    };
  };

  doDelete(workspaceName: string) {
    let currentSelection = this.chooser.selectedItem;
    this.workspacePlugin.deleteWorkspace(workspaceName);
    this.chooser.chooser.updateSuggestions();
    this.chooser.setSelectedItem(currentSelection - 1);
  }

  getItems(): any[] {
    return [...Object.keys(this.workspacePlugin.workspaces).sort()];
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
    else if (modifiers === "Alt") this.saveAndSwitch(), this.loadWorkspace(item);
    else if (this.settings.saveOnSwitch) {
      this.workspacePlugin.saveWorkspace(this.activeWorkspace);
      this.loadWorkspace(item);
    } else this.loadWorkspace(item);
  }

  setWorkspace(workspaceName: string) {
    this.workspacePlugin.setActiveWorkspace(workspaceName);
  }

  loadWorkspace(workspaceName: string) {
    this.workspacePlugin.loadWorkspace(workspaceName);
  }
}
