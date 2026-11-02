import * as vscode from "vscode";
import { extname } from "path";

export const MASM_EXTENSIONS = [".asm", ".inc", ".mac"];

/**
 * Sets up syntax highlighting control for MASM files
 * Switches between "MASM" (with highlighting) and "masm-plain" (without) based on settings
 */
export function setupSyntaxHighlightingControl(
  context: vscode.ExtensionContext,
) {
  const isMasmFile = (document: vscode.TextDocument): boolean =>
    MASM_EXTENSIONS.includes(extname(document.fileName).toLowerCase());

  const applyLanguageMode = async (document: vscode.TextDocument) => {
    if (!isMasmFile(document)) {
      return;
    }

    const config = vscode.workspace.getConfiguration("masmRunner");
    const highlightingEnabled = config.get<boolean>(
      "enableSyntaxHighlighting",
      true,
    );

    const targetLanguage = highlightingEnabled ? "MASM" : "masm-plain";

    if (document.languageId !== targetLanguage) {
      if (
        document.languageId === "MASM" ||
        document.languageId === "masm-plain"
      ) {
        try {
          await vscode.languages.setTextDocumentLanguage(
            document,
            targetLanguage,
          );
        } catch (error) {
          console.error(
            `Failed to set language mode for ${document.fileName}:`,
            error,
          );
        }
      }
    }
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      await applyLanguageMode(document);
    }),
  );

  // Apply language mode to already open documents when configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration("masmRunner.enableSyntaxHighlighting")) {
        // Update all currently open MASM files
        for (const document of vscode.workspace.textDocuments) {
          await applyLanguageMode(document);
        }
      }
    }),
  );

  // Apply language mode to all currently open documents on activation
  (async () => {
    for (const document of vscode.workspace.textDocuments) {
      await applyLanguageMode(document);
    }
  })();
}
