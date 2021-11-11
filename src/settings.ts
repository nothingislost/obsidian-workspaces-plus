import WorkspacesPlus from "./main";
import { App, PluginSettingTab, Setting } from "obsidian";

export class WorkspacesPlusSettings {
  showInstructions: boolean;
  showDeletePrompt: boolean;
  saveOnSwitch: boolean;
  saveOnChange: boolean;
  workspaceSettings: boolean;
}

export const DEFAULT_SETTINGS: WorkspacesPlusSettings = {
  showInstructions: true,
  showDeletePrompt: true,
  saveOnSwitch: false,
  saveOnChange: false,
  workspaceSettings: false,
};

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
      .setName("Store Obsidian settings per workspace")
      .setDesc(
        `This settings will store all of the native Obsidian Editor, Files & Links, 
        and Appearance settings to each workspace when the workspace is saved.
        Settings are stored in the workspace metadata and will be loaded along with the workspace.`
      )
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.workspaceSettings).onChange(value => {
          this.plugin.settings.workspaceSettings = value;
          this.plugin.saveData(this.plugin.settings);
        })
      );
  }
}
