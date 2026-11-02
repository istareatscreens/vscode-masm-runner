import * as vscode from "vscode";

export const TERMINAL_VIEW_TYPE = "masmRunner";

/** VS Code may prefix the view type with "mainThreadWebview-" */
export const isTerminalViewType = (viewType: string): boolean =>
  viewType === TERMINAL_VIEW_TYPE ||
  viewType === "mainThreadWebview-" + TERMINAL_VIEW_TYPE;

export function terminalTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter(
      (tab) =>
        tab.input instanceof vscode.TabInputWebview &&
        isTerminalViewType(tab.input.viewType),
    );
}
