import React, { useEffect, useState, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";

import Button from "../../common/ImageButton.jsx";
import Window from "../../common/Window.jsx";

import accept from "../../../../images/accept.png";
import acceptDisabled from "../../../../images/accept-disabled.png";

import {
  getFileExtension,
  debounce,
  checkFileExtension,
} from "../../../utility/utilityFunctions.ts";

//TODO REFACTOR TO CREATE DIFFERENT FILE TYPES
function CreateFileWindow({ createFile, closeFileWindow, fileList }) {
  const [value, setValue] = useState("");
  const inputbox = useRef(null);
  const [cannotCreate, setCannotCreate] = useState(true);

  useEffect(() => {
    inputbox.current.focus();
  }, []);

  const handleChange = ({ target }) => {
    setValue(target.value);
    activateCreateButton.callback();
  };

  //debounce to check if file name is proper
  const activateCreateButton = useDebouncedCallback(() => {
    setCannotCreate(value == "" || checkIfFilenameExists());
  }, 200);

  //If true then disable, if false dont disable
  //TODO: FIX THIS LOGIC
  const checkIfFilenameExists = () => {
    return fileList.find(
      (file) =>
        (getFileExtension(value)
          ? file
          : file.substring(0, file.length - getFileExtension(file).length)) ==
        value
    );
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !cannotCreate) {
      handleCreateFileButton();
      closeFileWindow();
    }
  };

  const handleCreateFileButton = () => {
    createFile(checkFileExtension(value, ".asm") ? value : value + ".asm");
  };

  return (
    <Window
      closeWindow={closeFileWindow}
      titlebarClass={"title-bar--create-file"}
      windowClass={"window--create-file"}
      titlebarText={"Create file"}
    >
      <input
        type="text"
        className="input-box"
        value={value}
        onKeyDown={(event) => {
          handleKeyDown(event);
        }}
        onChange={(event) => handleChange(event)}
        ref={inputbox}
      />
      <br></br>
      <div className="external-buttons external-buttons--createFile">
        <Button
          src={cannotCreate ? acceptDisabled : accept}
          className={"btn btn--window btn--createFile"}
          imageClass={"btn--window--image"}
          title="create file(s)"
          disabled={cannotCreate}
          onClick={handleCreateFileButton}
        />
      </div>
    </Window>
  );
}

export default CreateFileWindow;
