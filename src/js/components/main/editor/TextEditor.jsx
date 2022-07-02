import React, { useEffect, useRef, useState } from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import CodeMirror from "react-codemirror2";
import "codemirror/mode/gas/gas.js";
import "./library/simple";
import "./library/MASM.js";

import { useDebouncedCallback } from "use-debounce";

import FileSystem from "../utility/FileSystem.js";

function TextEditor({
  onChange,
  selectedTheme,
  value,
  filename,
  fontSize,
  selectedFont,
}) {
  const refCodeMirror = useRef(null);
  const handleChange = (editor, data, value) => {
    onChange(value);
    writeToLocalStorage.callback(filename, value);
  };

  //Change font family
  useEffect(() => {
    refCodeMirror.current.style.fontFamily = selectedFont.fontFamily
      ? selectedFont.fontFamily
      : selectedFont.text;
  }, [selectedFont]);

  //Change font size
  useEffect(() => {
    refCodeMirror.current.style.fontSize = fontSize + "px";
  }, [fontSize]);

  //debounce function to write code to local storage
  //use constant should be used once
  const writeToLocalStorage = useDebouncedCallback((filename, value) => {
    FileSystem.writeToFile(filename, value);
  }, 400);

  return (
    <div ref={refCodeMirror} className="editor">
      <CodeMirror
        value={value}
        onBeforeChange={handleChange}
        className="editor__code-mirror"
        options={{
          lineWrapping: true,
          lineNumbers: true,
          mode: "MASM",
          theme: selectedTheme,
        }}
      ></CodeMirror>
    </div>
  );
}

export default TextEditor;
