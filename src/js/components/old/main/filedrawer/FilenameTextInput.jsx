import React, { useRef, useEffect, useState } from "react";
import onClickOutside from "react-onclickoutside";

//TODO Generify this with CreateFile
function FilenameTextInput({
  filename,
  setEditingMode,
  handleRename,
  isFileSelected,
}) {
  const inputbox = useRef(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue(filename);
  }, [filename]);

  FilenameTextInput.handleClickOutside = () => {
    completedInput();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      completedInput();
    }
  };

  const completedInput = () => {
    if (filename != inputbox.current.value) {
      //check if file exists
      if (handleRename(filename, inputbox.current.value) && isFileSelected) {
        switchFile(inputbox.current.value);
      }
    }
    setEditingMode(false);
  };

  const handleChange = (event) => {
    if (event.target.value != filename) {
      setValue(event.target.value);
    }
  };

  return (
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
  );
}

const clickOutsideConfig = {
  handleClickOutside: () => FilenameTextInput.handleClickOutside,
};

export default onClickOutside(FilenameTextInput, clickOutsideConfig);
