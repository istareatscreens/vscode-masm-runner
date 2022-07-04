//taken from boxedwine.shell.js TODO call this code form iframe or strip out essential parts
import { Buffer } from "buffer";

var Inode = function Inode(id, size, mode, atime, mtime, ctime) {
  this.id = id;
  this.size = size;
  this.mode = mode;
  this.atime = atime;
  this.mtime = mtime;
  this.ctime = ctime;
};
/**
 * Converts the buffer into an Inode.
 */
var fromBuffer = function fromBuffer(buffer$$1) {
  if (buffer$$1 === undefined) {
    throw new Error("NO");
  }
  return new Inode(
    buffer$$1.toString("ascii", 30),
    buffer$$1.readUInt32LE(0),
    buffer$$1.readUInt16LE(4),
    buffer$$1.readDoubleLE(6),
    buffer$$1.readDoubleLE(14),
    buffer$$1.readDoubleLE(22)
  );
};
/**
 * Handy function that converts the Inode to a Node Stats object.
 */
Inode.prototype.toStats = function toStats() {
  return new Stats(
    (this.mode & 0xf000) === FileType.DIRECTORY
      ? FileType.DIRECTORY
      : FileType.FILE,
    this.size,
    this.mode,
    new Date(this.atime),
    new Date(this.mtime),
    new Date(this.ctime)
  );
};
/**
 * Get the size of this Inode, in bytes.
 */
Inode.prototype.getSize = function getSize() {
  // ASSUMPTION: ID is ASCII (1 byte per char).
  return 30 + this.id.length;
};
/**
 * Writes the inode into the start of the buffer.
 */
Inode.prototype.toBuffer = function toBuffer(buff) {
  if (buff === void 0) buff = Buffer.alloc(this.getSize());
  buff.writeUInt32LE(this.size, 0);
  buff.writeUInt16LE(this.mode, 4);
  buff.writeDoubleLE(this.atime, 6);
  buff.writeDoubleLE(this.mtime, 14);
  buff.writeDoubleLE(this.ctime, 22);
  buff.write(this.id, 30, this.id.length, "ascii");
  return buff;
};
/**
 * Updates the Inode using information from the stats object. Used by file
 * systems at sync time, e.g.:
 * - Program opens file and gets a File object.
 * - Program mutates file. File object is responsible for maintaining
 *   metadata changes locally -- typically in a Stats object.
 * - Program closes file. File object's metadata changes are synced with the
 *   file system.
 * @return True if any changes have occurred.
 */
Inode.prototype.update = function update(stats) {
  var hasChanged = false;
  if (this.size !== stats.size) {
    this.size = stats.size;
    hasChanged = true;
  }
  if (this.mode !== stats.mode) {
    this.mode = stats.mode;
    hasChanged = true;
  }
  var atimeMs = stats.atime.getTime();
  if (this.atime !== atimeMs) {
    this.atime = atimeMs;
    hasChanged = true;
  }
  var mtimeMs = stats.mtime.getTime();
  if (this.mtime !== mtimeMs) {
    this.mtime = mtimeMs;
    hasChanged = true;
  }
  var ctimeMs = stats.ctime.getTime();
  if (this.ctime !== ctimeMs) {
    this.ctime = ctimeMs;
    hasChanged = true;
  }
  return hasChanged;
};
// XXX: Copied from Stats. Should reconcile these two into something more
//  compact.
/**
 * @return [Boolean] True if this item is a file.
 */
Inode.prototype.isFile = function isFile() {
  return (this.mode & 0xf000) === FileType.FILE;
};
/**
 * @return [Boolean] True if this item is a directory.
 */
Inode.prototype.isDirectory = function isDirectory() {
  return (this.mode & 0xf000) === FileType.DIRECTORY;
};

export { fromBuffer, Inode };
