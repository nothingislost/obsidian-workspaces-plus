/* eslint-disable @typescript-eslint/ban-ts-comment */
import WorkspacesPlus from "./main";
import { App, PluginSettingTab, Setting } from "obsidian";

export class WorkspacesPlusSettings {
  showInstructions = true;
  showDeletePrompt = true;
  saveOnSwitch = false;
  showModification = false;
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
      .setName("Always save current workspace on workspace switch")
      .setDesc(`This option will always save your current workspace state prior to switching workspaces`)
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.saveOnSwitch).onChange(value => {
          this.plugin.settings.saveOnSwitch = value;
          this.plugin.saveData(this.plugin.settings);
        })
      );

    new Setting(containerEl)
      .setName("Experimental: Show workspace modified indicator")
      .setDesc(
        `This option will show an * next to the workspace name in the status bar when the workspace has been modified from its saved state`
      )
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.showModification).onChange(value => {
          this.plugin.settings.showModification = value;
          this.plugin.saveData(this.plugin.settings);
        })
      );
  }
}
