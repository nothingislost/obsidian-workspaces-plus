# Workspaces Plus

![Artboard-2-3](https://user-images.githubusercontent.com/46250921/133352216-e0a2c9b6-070b-46f7-9a6f-d3a18f0c69b1.png)

Workspaces Plus is a plugin that expands the functionality of [workspaces](https://help.obsidian.md/Plugins/Workspaces) in [Obsidian](https://obsidian.md/). 

## Features
**Workspace Indicator**
- current active workspace shown in status bar
- click on workspace name in status bar to open workspace picker menu 
- `*` indicates an unsaved workspace
- `shift-click` status bar icon or workspace name to save the workspace
<img src="https://user-images.githubusercontent.com/46250921/133325073-af2d58ec-e8a1-48fb-a48c-792b348235fd.png" width="350">

**Workspace Picker**
- switch, delete, rename, and create new workspaces
<img src="https://user-images.githubusercontent.com/46250921/133325287-94a36543-f0ee-4956-9ad5-91c572e5b3c4.png" width="350">

**Workspace Switcher modal**
- open with assignable hotkey
- switch, delete, rename, and create new workspaces
<img src="https://user-images.githubusercontent.com/46250921/133325396-bc429aa5-696f-4e44-8e78-4a9bd504867e.png" width="400">

**Hotkeys**
- open Workspaces Plus switcher modal

**Plugin Options**
- Toggle keyboard shortcuts on/off for Workspace Picker
- Toggle workspace delete confirmation on/off
- Set default workspace switch behavior to always save when switching
- Show workspace modified indicator

## How to use
After enabling the plugin from the settings menu, you will see that a workspace icon has been added to the status bar in the lower right corner of the interface. If you are already using workspaces in Obsidian, you will notice that the name of your current active workspace is located next to the that icon.

### Creating a Workspace
You can create a workspace through either the Workspace Picker or the Workspace Switcher modal with the same workflow
1. Type your new workspace name into the input field
2. Use `shift-enter` to create the new workspace
### Renaming a Workspace
Rename workspaces from the picker or modal by clicking on the pencil icon next to the workspace name
### Deleting a Workspace
Workspaces can be deleted by either using the trach can icon next to the workspaces name or pressing the shortcut `shift-delete` while the workspace is selected in the menu
### Opening a Workspace
1. Open the Workspace Switcher via hotkey or click on the workspace icon or name in status bar to open the Workspace Picker
2. You can open a workspace by clicking on it with your mouse or by pressing enter after navigating to it with the up/down arrows on your keyboard
### Saving Workspaces
- By default, workspaces are not automatically saved when switched
- You can save a workspace with `shift-click` on the workspace icon or name in the status bar
- From either switcher menu you can use `shift-enter` to save your current active workspace or `alt-enter` to save your current active workspace and switch to the new one you have selected
- In the Plugin Options menu (located in Obsidians settings) you can toggle on a setting which will automatically save the active workspace on switch

## Installation

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-workspaces-plus/`.
- via Obsidian Community Plugins (coming soon)

## Feedback
Share feedback, issues, and ideas on [github](https://github.com/nothingislost/obsidian-workspaces-plus/issues) or feel free to tag the authors on Discord

## Credits
- This plugin is being developed by [Johnny ✨](https://github.com/jsmorabito) and [Nothingislost](https://github.com/nothingislost)
- Workspace Picker and Modal based off of [Obsidian Theme Picker](https://github.com/kenset/obsidian-theme-picker) by [Kenset](https://github.com/kenset)
