/* eslint-disable @typescript-eslint/ban-ts-comment */
import WorkspacePicker from "./main";
import { App, PluginSettingTab, Setting } from "obsidian";

export class WorkspacePickerSettings {
  showInstructions = true;
  showDeletePrompt = true;
  saveOnSwitch = false;
}

export class WorkspacePickerSettingsTab extends PluginSettingTab {
  plugin: WorkspacePicker;

  constructor(app: App, plugin: WorkspacePicker) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Workspace Picker Options" });

    new Setting(containerEl)
      .setName("Show instructions")
      .setDesc(`Show instructions on the workspace dropdown that explain the various keyboard shortcuts`)
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
      .setName("Always save current workspace on workspace switch")
      .setDesc(`This option will always save your current workspace state prior to switching workspaces`)
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.saveOnSwitch).onChange(value => {
          this.plugin.settings.saveOnSwitch = value;
          this.plugin.saveData(this.plugin.settings);
        })
      );
  }
}
