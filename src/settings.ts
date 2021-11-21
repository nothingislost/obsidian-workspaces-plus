import WorkspacesPlus from "./main";
import { App, PluginSettingTab, Setting } from "obsidian";
import { FileSuggest } from "./suggesters/fileSuggest";

const SETTINGS_ATTR = "workspaces-plus:settings-v1";
export class WorkspacesPlusSettings {
  showInstructions: boolean;
  showDeletePrompt: boolean;
  saveOnSwitch: boolean;
  saveOnChange: boolean;
  workspaceSettings: boolean;
  systemDarkMode: boolean;
  globalSettings: Object;
  activeWorkspaceDesktop: string;
  activeWorkspaceMobile: string;
  reloadLivePreview: boolean;
  workspaceSwitcherRibbon: boolean;
  modeSwitcherRibbon: boolean;
  replaceNativeRibbon: boolean;
}

export const DEFAULT_SETTINGS: WorkspacesPlusSettings = {
  showInstructions: true,
  showDeletePrompt: true,
  saveOnSwitch: false,
  saveOnChange: false,
  workspaceSettings: false,
  systemDarkMode: false,
  globalSettings: {},
  activeWorkspaceDesktop: "",
  activeWorkspaceMobile: "",
  reloadLivePreview: false,
  workspaceSwitcherRibbon: false,
  modeSwitcherRibbon: false,
  replaceNativeRibbon: true,
};

function getChildIds(split: any, leafs: any[] = null): any {
  if (!leafs) leafs = [];
  if (split.type == "leaf") {
    leafs.push({ id: split.id, file: split.state.state.file, mode: split.state.state.mode });
  } else if (split.type == "split") {
    split.children.forEach((child: any) => {
      getChildIds(child, leafs);
    });
  }
  return leafs;
}

export class WorkspacesPlusSettingsTab extends PluginSettingTab {
  plugin: WorkspacesPlus;

  constructor(app: App, plugin: WorkspacesPlus) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Workspaces Plus" });
    containerEl.createEl("h3", {
      text: "Quick Switcher Settings",
    });
    new Setting(containerEl)
      .setName("Show instructions")
      .setDesc(`Show available keyboard shortcuts at the bottom of the workspace quick switcher`)
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.showInstructions).onChange(value => {
          this.plugin.settings.showInstructions = value;
          this.plugin.saveData(this.plugin.settings);
        })
      );

    new Setting(containerEl)
      .setName("Show workspace delete confirmation")
      .setDesc(`Show a confirmation prompt on workspace deletion`)
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.showDeletePrompt).onChange(value => {
          this.plugin.settings.showDeletePrompt = value;
          this.plugin.saveData(this.plugin.settings);
        })
      );

    new Setting(containerEl)
      .setName("Show Workspace Sidebar Ribbon Icon")
      // .setDesc(``)
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.workspaceSwitcherRibbon).onChange(value => {
          this.plugin.settings.workspaceSwitcherRibbon = value;
          this.plugin.saveData(this.plugin.settings);
          if (value) this.plugin.showWorkspaceRibbonButton();
          else this.plugin.ribbonIconWorkspaces.hide();
        })
      );

    new Setting(containerEl)
      .setName("Show Workspace Mode Sidebar Ribbon Icon")
      // .setDesc(``)
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.modeSwitcherRibbon).onChange(value => {
          this.plugin.settings.modeSwitcherRibbon = value;
          this.plugin.saveData(this.plugin.settings);
          if (value) this.plugin.showModeRibbonButton();
          else this.plugin.ribbonIconMode.hide();
        })
      );

    new Setting(containerEl)
      .setName("Hide the native Workspace Sidebar Ribbon Icon")
      // .setDesc(``)
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.replaceNativeRibbon).onChange(value => {
          this.plugin.settings.replaceNativeRibbon = value;
          this.plugin.saveData(this.plugin.settings);
          if (!this.plugin.nativeWorkspaceRibbonItem)
            this.plugin.nativeWorkspaceRibbonItem = document.body.querySelector('[aria-label="Manage workspaces"]');
          if (value) this.plugin.nativeWorkspaceRibbonItem.hide();
          else this.plugin.nativeWorkspaceRibbonItem.show();
        })
      );
    containerEl.createEl("h3", {
      text: "Workspace Enhancements",
    });

    new Setting(containerEl)
      .setName("Enable Workspace Modes")
      .setDesc(
        `Modes are a new type of Workspace that store all of the native Obsidian Editor, Files & Links, 
        and Appearance settings. Enabling this will add a new mode switcher to the status bar that will allow you
        to save, apply, rename, and switch between modes.`
      )
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.workspaceSettings).onChange(value => {
          this.plugin.settings.workspaceSettings = value;
          this.plugin.saveData(this.plugin.settings);
          this.plugin.toggleModesFeature();
        })
      );

    new Setting(containerEl)
      .setName("Auto save the current workspace on layout change")
      .setDesc(
        `This option will auto save your current workspace on any layout change.
                Leave this disabled if you want full control over when your workspace is saved.`
      )
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.saveOnChange).onChange(value => {
          this.plugin.settings.saveOnChange = value;
          this.plugin.saveData(this.plugin.settings);
        })
      );

    new Setting(containerEl)
      .setName("Respect system dark mode setting")
      .setDesc(
        `Let the OS determine the light/dark mode setting when switching modes. This setting can only be used if Workspace Modes is enabled.`
      )
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.systemDarkMode).onChange(value => {
          this.plugin.settings.systemDarkMode = value;
          this.plugin.saveData(this.plugin.settings);
        })
      );

    new Setting(containerEl)
      .setName("Automatically reload Obsidian on Live Preview setting change")
      .setDesc(
        `When switching between Modes with different Experimental Live Preview settings, reload Obsidian in order for the setting
                change to take effect. ⚠️Note: Obsidian will reload automatically after changing workspaces, if needed, without any prompts.`
      )
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.reloadLivePreview).onChange(value => {
          this.plugin.settings.reloadLivePreview = value;
          this.plugin.saveData(this.plugin.settings);
        })
      );

    containerEl.createEl("h3", {
      text: "Per Workspace Settings",
    });
    let { workspaces } = this.plugin.workspacePlugin;
    Object.entries(workspaces).forEach(entry => {
      const [workspaceName, workspace] = entry;
      if (workspaceName.match(/^mode:/i)) return;
      containerEl.createEl("h3", {
        text: workspaceName,
      });
      new Setting(containerEl).setName(`Workspace Description`).addText(textfield => {
        textfield.inputEl.type = "text";
        textfield.setValue(String(workspace[SETTINGS_ATTR].description || ""));
        textfield.onChange(value => {
          workspace[SETTINGS_ATTR] && (workspace[SETTINGS_ATTR].description = value);
          this.plugin.workspacePlugin.saveData();
        });
      });
      new Setting(containerEl)
        .setName(`Auto save workspace on changes`)
        // .setDesc(``)
        .addToggle(toggle =>
          toggle.setValue(workspace[SETTINGS_ATTR]?.autoSave).onChange(value => {
            workspace[SETTINGS_ATTR] && (workspace[SETTINGS_ATTR].autoSave = value);
            this.plugin.workspacePlugin.saveData();
          })
        );
      containerEl.createEl("h5", {
        text: "File Overrides",
      });
      getChildIds(workspace.main).forEach((leaf: any) => {
        new Setting(containerEl)
          .setName(leaf.file)
          // TODO: Allow for settings leaf.state.type = "empty"
          // TODO: Allow for dynamic file names
          .addSearch(cb => {
            new FileSuggest(this.app, cb.inputEl);
            cb.setPlaceholder("Example: folder1/template_file")
              .setValue(leaf.file)
              .onChange(overrideFile => {
                console.log(overrideFile);
              });
          });
      });
    });
    containerEl.createEl("h3", {
      text: "Per Mode Settings",
    });
    Object.entries(workspaces).forEach(entry => {
      const [workspaceName, workspace] = entry;
      if (!workspaceName.match(/^mode:/i)) return;
      containerEl.createEl("h3", {
        text: workspaceName.replace(/^mode: /i, ""),
      });
      new Setting(containerEl)
        .setName(`Store sidebar state`)
        // .setDesc(``)
        .addToggle(toggle =>
          toggle.setValue(workspace[SETTINGS_ATTR]?.saveSidebar).onChange(value => {
            workspace[SETTINGS_ATTR] && (workspace[SETTINGS_ATTR].saveSidebar = value);
            this.plugin.workspacePlugin.saveData();
          })
        );
    });
  }
}
