import { Inode, fromBuffer } from "./inode";
import { Buffer } from "buffer";
//Helper functions, that should be typed in the future

//Access keys from storage
export const getFromLocalStorage = (key) => window.localStorage.getItem(key);
export const setInLocalStorage = (key, value, encoder) =>
  window.localStorage.setItem(key, encoder(value));

//Decode and Encode Data from LocalStorage
export const decodeFileMetaData = (data) =>
  fromBuffer(Buffer.from(data, "base64"));
export const encodeFileMetaData = (data) => data.toBuffer().toString("base64");
export const decodeFileData = (value) => window.atob(value);
export const encodeFileData = (value) => window.btoa(value);

//pull data
export const getFileMetaData = (key) =>
  decodeFileMetaData(getFromLocalStorage(key));
export const getFileData = (key) => decodeFileData(getFromLocalStorage(key));
