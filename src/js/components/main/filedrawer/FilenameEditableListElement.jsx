import React, { useState } from "react";
import FilenameListElement from "./FilenameListElement.jsx";
import FilenameTextInput from "./FilenameTextInput.jsx";

//TODO generify this
const FilenameEditableListElement = React.memo(
  ({ filename, handleRename, switchFile, isFileSelected, lightMode }) => {
    const [isInEditingMode, setEditingMode] = useState(false);

    const toggleEdit = () => {
      setEditingMode(!isInEditingMode);
    };

    const handleDoubleClick = () => {
      if (!isInEditingMode) {
        toggleEdit();
      }
    };

    const handleSingleClick = (event) => {
      if (!isInEditingMode) {
        switchFile(filename);
      }
    };

    return (
      <FilenameListElement
        lightMode={lightMode}
        onDoubleClick={handleDoubleClick}
        onClick={handleSingleClick}
        isFileSelected={isFileSelected}
      >
        {isInEditingMode ? (
          <FilenameTextInput
            setEditingMode={setEditingMode}
            filename={filename}
            handleRename={handleRename}
            switchFile={switchFile}
          />
        ) : (
          filename
        )}
      </FilenameListElement>
    );
  }
);

export default FilenameEditableListElement;
