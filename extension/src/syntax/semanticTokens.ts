import * as vscode from "vscode";
import {
  TOKEN_MODIFIERS,
  TOKEN_TYPES,
  classifyMasm,
} from "./semanticClassifier";
import { loadMasmLezer } from "./masmParser";

export const semanticTokensLegend = new vscode.SemanticTokensLegend(
  [...TOKEN_TYPES],
  [...TOKEN_MODIFIERS],
);

export function setupSemanticHighlighting(
  context: vscode.ExtensionContext,
): void {
  const lezer = loadMasmLezer();
  if (!lezer) return;
  const provider: vscode.DocumentSemanticTokensProvider = {
    provideDocumentSemanticTokens(document, token) {
      const tokens = classifyMasm(
        lezer,
        document.getText(),
        () => token.isCancellationRequested,
      );
      if (!tokens) throw new vscode.CancellationError();
      const builder = new vscode.SemanticTokensBuilder(semanticTokensLegend);
      for (const t of tokens)
        builder.push(t.line, t.char, t.length, t.type, t.modifiers);
      return builder.build();
    },
  };
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: "MASM" },
      provider,
      semanticTokensLegend,
    ),
  );
}
