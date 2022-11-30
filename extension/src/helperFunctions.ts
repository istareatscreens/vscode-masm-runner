import * as vscode from "vscode";
import fs = require("fs");

export const doubleQuoteSpacedDirectories = (path: string) => {
  const [drive, ...delineatedDirectory] = path.split("\\");
  return `${drive}\\${delineatedDirectory
    .map((directory) => (/\s/.test(directory) ? `"${directory}"` : directory))
    .join("\\")}`;
};

export const replaceIrvine = (document: string, irvine32Inc: string) => {
  const irvineLib32Match = /include.+irvine32(\.inc|)/im;
  return document.replace(irvineLib32Match, "INCLUDE " + irvine32Inc);
};

const createFile = async (path: string, fileData: string) => {
  fs.promises.writeFile(path, fileData);
};
