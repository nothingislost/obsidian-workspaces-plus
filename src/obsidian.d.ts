import "obsidian";

declare module "obsidian" {
  export interface FuzzySuggestModal<T> {
    chooser: Chooser<T>;
    suggestEl: HTMLDivElement;
  }

  export interface Chooser<T> {
    setSelectedItem(selectedIdx: number, scroll?: boolean): void;
    useSelectedItem(evt: MouseEvent | KeyboardEvent): void;
    values: { [x: string]: { item: any } };
    selectedItem: number;
    chooser: Chooser<T>;
    setSuggestions(items: any[]): void;
    containerEl: HTMLElement;
    addMessage(message: string): void;
    updateSuggestions(): void;
    suggestions: { scrollIntoViewIfNeeded: () => void }[];
  }
  export interface Vault {
    getConfig(config: string): unknown;
    setConfig(config: string, value: unknown): void;
    readConfigJson(section: string): Object;
    saveConfig(): void;
    config: Object;
  }
  export interface Vault extends Events {
    on(name: "config-changed", callback: () => any): EventRef;
  }
  export interface App {
    isMobile(): boolean;
    setTheme(mode: string): void;
    internalPlugins: InternalPlugins;
    viewRegistry: ViewRegistry;
    loadLocalStorage(setting: string): any;
    saveLocalStorage(setting: string, values: Object): void;
    getTheme(): string;
    changeBaseFontSize(fontSize: number): void;
    changeTheme(theme: string): void;
    customCss: {
      theme: string;
      loadData(): void;
      applyCss(): void;
      setTheme(theme: string): void;
    };
    plugins: {
      plugins: {
        "cmenu-plugin": {
          _loaded: boolean;
          settings: { menuCommands: { id: string; name: string }[] };
          saveSettings(): void;
        };
      };
    };
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
    saveData(): void;
    workspaces: { [x: string]: Workspaces }; // TODO: improve this typing
  }

  export interface Workspace extends Events {
    updateOptions(): void;
    on(name: "workspace-load", callback: (workspaceName: string) => any, ctx?: any): EventRef;
    on(name: "workspace-save", callback: (workspaceName: string, modeName: string) => any, ctx?: any): EventRef;
    on(name: "workspace-delete", callback: (workspaceName: string) => any, ctx?: any): EventRef;
    on(
      name: "workspace-rename",
      callback: (newWorkspaceName: string, oldWorkspaceName: string) => any,
      ctx?: any
    ): EventRef;
  }

  export interface Workspaces {
    [x: string]: any; // TODO: improve this typing
  }
}
