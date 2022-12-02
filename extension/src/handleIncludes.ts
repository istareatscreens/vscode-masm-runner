import * as vscode from "vscode";
import { ASM_EXTENSION, INC_EXTENSION } from "./constants";
import { basename, dirname, extname, join } from "path";
import nodeDir = require("node-dir");
import { doubleQuoteSpacedDirectories } from "./helperFunctions";
import { WorkspaceFolder } from "vscode";
import { BasenamePathMap, WorkSpaceFileData } from "./types";

export const handleIncludes = async (
  document: undefined | vscode.TextDocument,
  irvine32Inc: string
) => {
  if (document === undefined) {
    return;
  }

  const includeStatements = getIncludeStatements(document.getText());
  if (includeStatements.length === 0) {
    return;
  }

  const newDocumentText = replaceIrvine(document.getText(), irvine32Inc);

  if (
    vscode.workspace.workspaceFolders === undefined ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    return;
  }

  const { workSpaceFolders, incFiles, asmFiles } = await getWorkspaceFiles(
    basename(document.fileName)
  );

  if (incFiles.length === 0) {
    return;
  }
};

const readAndReplaceIncludes = async (
  fileUri: string,
  incFiles: BasenamePathMap[],
  asmFiles: BasenamePathMap[],
  workSpaceFolder: string
) => {
  const uri = vscode.Uri.parse(fileUri);
  const document = await vscode.workspace.openTextDocument(uri);
  const includeStatements = getIncludeStatements(document.getText());
  if (includeStatements.length === 0) {
    return;
  }
};

const getWorkspaceFiles = async (
  mainDocumentName: null | string = null
): Promise<WorkSpaceFileData> => {
  const workspaceFolders = (<vscode.WorkspaceFolder[]>(
    vscode.workspace.workspaceFolders
  )).map((folder: WorkspaceFolder) => folder.uri.fsPath);

  const workspaceFiles = (
    await Promise.all(
      workspaceFolders.map((dir: string) => nodeDir.promiseFiles(dir))
    )
  ).flat();

  return {
    workSpaceFolders: workspaceFolders,
    incFiles: workspaceFiles
      .filter((file) => extname(file) === INC_EXTENSION)
      .map((file) => ({
        [basename(file)]: file,
      })),
    asmFiles: workspaceFiles
      .filter(
        (file) =>
          extname(file) === ASM_EXTENSION && basename(file) !== mainDocumentName
      )
      .map((file) => ({
        [basename(file)]: file,
      })),
  };
};

const getIncludeStatements = (document: string) => {
  const includeStatementMatch =
    /(^([^\S\r\n\d]+|^)include([^\S\r\n])([^\s\n\r]+))/gim;
  const includeMatch = /INCLUDE([^\S\r\n\d]+|^)/gim;
  return [...document.matchAll(includeStatementMatch)].map(
    (match: string[]) => ({
      [<string>(
        basename(match[0].trim().replace(includeMatch, "")).toLowerCase()
      )]: match[0].trim(),
    })
  );
};

const replaceIrvine = (document: string, irvine32Inc: string) => {
  const irvineLib32Match = /include.+irvine32(\.inc|)/im;
  return document.replace(irvineLib32Match, "INCLUDE " + irvine32Inc);
};
