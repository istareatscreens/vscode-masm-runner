import React, { useRef } from "react";

import Button from "../../common/ImageButton.jsx";
import Switch from "../../common/ImageSwitch.jsx";

import newFile from "../../../../images/newFile.png";
import uploadFile from "../../../../images/uploadFile.png";
import saveFile from "../../../../images/saveFile.png";
import deleteFile from "../../../../images/deleteFile.png";
import files from "../../../../images/files.png";

//TODO: Add more descriptive icon for file type switch
function FileDrawerMenu({
  fileUploadInput,
  selectAllCheckbox,
  handleSelectAllCheckBox,
  handleNewFileButtonClick,
  handleUploadFiles,
  saveFiles,
  handleDeleteFile,
  switchFileView,
}) {
  return (
    <>
      <div className="banner__file-drawer">
        <input
          type="checkbox"
          title="Select all"
          className="checkbox checkbox--filedrawer checkbox--selectAll"
          onClick={(event) => handleSelectAllCheckBox(event.target.checked)}
          ref={selectAllCheckbox}
        />
        <Button
          src={newFile}
          className={"banner__file-drawer__btn"}
          title="create new assembly (.asm) text file"
          onClick={handleNewFileButtonClick}
        />
        <Button
          src={uploadFile}
          className={"banner__file-drawer__btn"}
          title="add file(s) to project"
          onClick={() => fileUploadInput.current.click()}
        />
        <input
          onChange={(event) => handleUploadFiles(event)}
          id="uploadFilesInput"
          ref={fileUploadInput}
          className={"file-upload-input file-upload-input--hidden"}
          type="file"
          multiple
        />
        <Button
          src={saveFile}
          className={"banner__file-drawer__btn"}
          title="save selected file(s)"
          onClick={saveFiles}
        />
        <Button
          src={deleteFile}
          className={"banner__file-drawer__btn"}
          title="delete selected file(s)"
          onClick={handleDeleteFile}
        />
        <Switch
          className={"switch--file-drawer"}
          imgClass={"switch--file-switch"}
          title={"switch file type view"}
          onClick={(event) => switchFileView(event)}
          src={files}
        />
      </div>
    </>
  );
}

export default FileDrawerMenu;
