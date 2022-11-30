import vscode = require("vscode");
import path = require("path");
import fs = require("fs");

type FileData = {
  scheme: string;
  $mid: number;
  external: vscode.Uri;
  fsPath: string;
  path: string;
  schema: string;
  _sep: number;
};

type WorkspaceFileList = [FileData, FileData[]];

type Merge<A, B> = { [K in keyof (A | B)]: K extends keyof B ? B[K] : A[K] };

type FileProfile = {
  filename: string;
  fileExtension: string;
  fileBaseName: string;
  filePath: string;
  fileData: Buffer;
  fileMetaData: fs.Stats;
  isBinary: boolean;
};

export type WorkSpaceFileData = {
  workSpaceFolders: string[];
  incFiles: string[];
  asmFiles: string[];
};
