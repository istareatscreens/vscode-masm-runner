import * as vscode from "vscode";
import { ASM_EXTENSION, INC_EXTENSION } from "./constants";
import { basename, dirname, extname, join } from "path";
import nodeDir = require("node-dir");
import { doubleQuoteSpacedDirectories } from "./helperFunctions";
import { WorkspaceFolder } from "vscode";
import { WorkSpaceFileData } from "./types";

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

  // TODO: Add check for new includes files
  const { workSpaceFolders, incFiles, asmFiles } = await getWorkspaceFiles(
    basename(document.fileName)
  );

  if (incFiles.length === 0) {
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
    incFiles: workspaceFiles.filter((file) => extname(file) === INC_EXTENSION),
    asmFiles: workspaceFiles.filter(
      (file) =>
        extname(file) === ASM_EXTENSION && basename(file) !== mainDocumentName
    ),
  };
};

const getIncludeStatements = (document: string) => {
  const includeMatch = /(^([^\S\r\n\d]+|^)include([^\S\r\n])([^\s\n\r]+))/gim;
  return [...document.matchAll(includeMatch)].map(
    (match: string[]) => match[0]
  );
};

const replaceIrvine = (document: string, irvine32Inc: string) => {
  const irvineLib32Match = /include.+irvine32(\.inc|)/im;
  return document.replace(irvineLib32Match, "INCLUDE " + irvine32Inc);
};
