import { Inode, fromBuffer } from "./filesystem/inode";
import { Buffer } from "buffer";
import {
  generateRandomID,
  renameObjectKey,
  getFileExtension,
} from "../../utility/utilityFunctions.ts";
import * as hf from "./filesystem/FSHelperFunctions.js";
import { saveAs } from "file-saver";

import dataURItoBlob from "./filesystem/dataURItoBlob.js";

const mimeType = (fileExtension) => {
  if (fileExtension == null) {
    return createMime("application/octet-stream");
  }

  const createMime = (mimeType) => {
    return "data:" + mimeType + "base64,";
  };
  switch (fileExtension) {
    case ".txt":
    case ".text":
    case ".asm":
      return createMime("text/plain");
    case ".exe":
      return createMime("application/x-msdownload");
    case ".jpg":
    case ".jpeg":
      return createMime("image/jpeg");
    case ".bmp":
      return createMime("image/bmp");
    case ".png":
      return createMime("image/png");
    case ".gif":
      return createMime("image/gif");
    case ".wav":
      return createMime("audio/wav");
    case ".zip":
      return createMime("application/zip");
    case ".obj":
    case ".bin":
    default:
      return createMime("application/octet-stream");
  }
};

function getFormatedDate() {
  const date = new Date();
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ]
    .map((value) => {
      const format = String(value);
      return format.length < 2 ? "0" + format : format;
    })
    .join("_");
}

const callBackIsTrue = async (
  callback,
  delay,
  resolutionFunction = () => {}
) => {
  return new Promise((resolve) => {
    if (callback()) resolve(resolutionFunction());
    let wait = setInterval(function () {
      if (callback()) {
        clearInterval(wait);
        resolve(resolutionFunction());
      }
    }, delay);
  });
};

/*
FileSystem for mananging changes to Boxedwine files
*/
export default class FileSystem {
  static locked = false;
  static fileListKey = "";

  static async init() {
    //check to see if local storage was loaded
    return callBackIsTrue(
      () => hf.getFromLocalStorage("/") != null,
      100,
      () => FileSystem._readFileListKey()
    );
  }

  //reads file list
  static _readFileList() {
    try {
      return JSON.parse(
        window.atob(hf.getFromLocalStorage(FileSystem.fileListKey))
      );
    } catch {
      window.localStorage.clear();
      window.dispatchEvent(
        new CustomEvent("push-message-to-vscode", {
          detail: {
            message:
              "File system has become corrupted please close and reopen the masm webview if issues persist please ",
          },
        })
      );
    }
  }

  //Gets file list key
  static _readFileListKey() {
    FileSystem.fileListKey = hf.decodeFileMetaData(
      hf.getFromLocalStorage("/")
    ).id;
  }

  //gets all stored files
  static getFileList() {
    return Object.keys(FileSystem._readFileList());
  }

  //gets data from file
  static getFileMetaData(filename) {
    return hf.getFileMetaData(FileSystem._readFileList()[filename]);
  }

  static getFileData(filename) {
    return hf.getFileData(
      hf.getFileMetaData(FileSystem._readFileList()[filename]).id
    );
  }

  static getFile(filename) {
    const fileList = FileSystem._readFileList();
    const selectedFile = fileList?.[filename] ?? null;
    if (!selectedFile) {
      return null;
    }
    const key = hf.getFileMetaData(selectedFile).id;
    return window.localStorage.getItem(key);
  }

  /**
   * @description finds file in local storage and replaces its text
   * @param {string} fileName name of assembly file exlcuding the .asm filename suffix
   * @param {string?} text text to be written to the file
   * @returns void
   * @Example writeToAssemblyFile("file", "assembly code here")
   */
  static writeToFile(filename, text) {
    //get data
    const fileMetaDataKey = FileSystem._readFileList()[filename];
    const fileMetaData = hf.getFileMetaData(fileMetaDataKey);

    //Append changes
    fileMetaData.size = text.length;

    //save file
    hf.setInLocalStorage(fileMetaDataKey, fileMetaData, hf.encodeFileMetaData); //meta data
    hf.setInLocalStorage(fileMetaData.id, text, hf.encodeFileData); //file data
  }

  static renameFile(filename, newFileName) {
    let fileList = FileSystem._readFileList();
    //rename file in list

    fileList = renameObjectKey(fileList, filename, newFileName);
    hf.setInLocalStorage(
      FileSystem.fileListKey,
      JSON.stringify(fileList),
      btoa
    );
  }

  //TODO change INCLUDE Irvine import to correct one
  static createDataFiles(files) {
    return files
      .map((file) => {
        let { filename, fileData, lastModified, fileSize, isBinary } = file;
        let isEncoded = isBinary;

        const isDuplicate = filename in FileSystem._readFileList();

        FileSystem.createFile(
          filename,
          fileData,
          lastModified,
          isEncoded,
          fileSize,
          isDuplicate
        );

        if (isDuplicate) {
          return "";
        }

        return ` echo.>${filename} &`;
      })
      .join("");
  }

  static createAssemblyFile(filename, isInitial = false) {
    //if (!(`${filename}.asm` in fileList)) { //turn this into a call back or something
    const template = `INCLUDE D:/irvine/Irvine32.inc

  .data                          ;data decleration

  
  .code                          ;code decleration

  
  main PROC                      ;main method starts
  
     call DumpRegs
  
     exit                        ;Exit program
  main ENDP
  END main`;
    FileSystem.createFile(filename, template, new Date().getTime(), isInitial);
    //}
  }

  /*TODO Fix BUG should create file first in boxedwine then append (promise) to it to prevent ghost files*/
  static createFile(
    filename,
    data,
    time,
    dataIsEncoded = false,
    size = 0,
    isDuplicate = null
  ) {
    if (isDuplicate === null) {
      isDuplicate = filename in FileSystem._readFileList();
    }
    //console.log({ CreatedFile: filename, data: data });
    let fileList = FileSystem._readFileList();

    //generate keys and creation time
    const id = isDuplicate
      ? hf.getFileMetaData(fileList[filename]).id
      : generateRandomID();
    const fileID = isDuplicate ? fileList[filename] : generateRandomID();

    //Delete old keys if duplicate
    if (isDuplicate) {
      localStorage.removeItem(id); //delete file metaData
      localStorage.removeItem(fileID); //delete file Data
    }

    //Add file to list of files if not duplicate
    if (!isDuplicate) {
      fileList[filename] = fileID;
      //store in file list
      hf.setInLocalStorage(
        FileSystem.fileListKey,
        JSON.stringify(fileList),
        btoa
      );
    }

    //store file data in local storage
    hf.setInLocalStorage(
      id,
      data,
      dataIsEncoded ? (data) => data : hf.encodeFileData //only encode data that needs to be
    );

    //store file meta data
    const metaData = new Inode(
      id,
      size ? size : data.length,
      33206,
      time,
      time,
      time
    );
    hf.setInLocalStorage(fileID, metaData, hf.encodeFileMetaData);

    /* depreciated
    if (!shouldWriteCommand && !isDuplicate) {
      //Write to console
      writeCommandToCMD(`echo.>${filename}`);
    }
    */
  }

  static deleteFile(filename) {
    //console.log("HERE: " + filename);
    let fileList = FileSystem._readFileList();
    if (`${filename}` in fileList) {
      const id = fileList[filename];
      //console.log(hf.getFileMetaData(id));
      localStorage.removeItem(hf.getFileMetaData(id).id); //delete file contents
      localStorage.removeItem(id); //delete file metaData
      delete fileList[`${filename}`];
      //remove file from file list
      hf.setInLocalStorage(
        FileSystem.fileListKey,
        JSON.stringify(fileList),
        btoa
      );
    }
  }

  /*
  Save file feature should be cealled from MAIN components only not Boxedwine components
  as it uses postMessage
  */
  static saveFile(filename) {
    const fileExtension = getFileExtension(filename);
    saveAs(
      dataURItoBlob(
        //convert to blob file for download
        mimeType(fileExtension) + //get file extension
          window.localStorage.getItem(
            hf.getFileMetaData(FileSystem._readFileList()[filename]).id
          )
      ),
      filename.substring(0, filename.length - fileExtension.length) +
        getFormatedDate() +
        fileExtension
    );
  }

  static async saveFiles(filenames, postMessage) {
    const fileList = FileSystem._readFileList();
    const filename = "MASMProjectFiles_" + getFormatedDate() + ".zip";
    /*
    send to boxedwine component as it has jsZip included, 
    using post message to reduce bundle size, zipped file 
    is temporarily stored in local storage after zip for retrieval
    */
    postMessage("zip-files", {
      data: {
        fileList: filenames.map((filename) => ({
          filename: filename,
          key: hf.getFileMetaData(fileList[filename]).id,
        })),
        filename: filename,
      },
    });

    /*
      wait for Boxedwine to finish zipping files then convert it
      to a blob and delete it from local storage
    */
    await callBackIsTrue(
      () => {
        return window.localStorage.getItem(filename) != null;
      }, //check for file
      20
    );
    saveAs(
      dataURItoBlob(mimeType(".zip") + window.localStorage.getItem(filename)),
      filename
    );
    window.localStorage.removeItem(filename); //clean up
  }
}
