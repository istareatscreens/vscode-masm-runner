import React, { useCallback, useEffect, useState, useRef } from "react";

import FileDrawer from "./filedrawer/FileDrawer.jsx";
import CommandPrompt from "./cmd/CommandPrompt.jsx";
import Editor from "./editor/Editor.jsx";
import Banner from "./banner/Banner.jsx";

import FileSystem from "./utility/FileSystem";
import { setInLocalStorage } from "./utility/filesystem/FSHelperFunctions.js";
import { postMessage } from "../../utility/utilityFunctions.ts";

function App() {
  const [filename, setFilename] = useState("test");
  const [fileList, setFileList] = useState([""]);
  const [lockEditor, setEditorLock] = useState(false);

  //TODO: Change how this is done
  const [refreshFile, setRefreshFile] = useState(true); //value switched to force editor rerender

  const [themeList, setThemeList] = useState([
    { id: 0, text: "default" },
    { id: 1, text: "3024-day" },
    { id: 2, text: "3024-night" },
    { id: 3, text: "abcdef" },
    { id: 4, text: "ambiance-mobile" },
    { id: 5, text: "ambiance" },
    { id: 6, text: "ayu-dark" },
    { id: 7, text: "ayu-mirage" },
    { id: 8, text: "base16-dark" },
    { id: 9, text: "base16-light" },
    { id: 10, text: "bespin" },
    { id: 11, text: "blackboard" },
    { id: 12, text: "cobalt" },
    { id: 13, text: "colorforth" },
    { id: 14, text: "darcula" },
    { id: 15, text: "dracula" },
    { id: 16, text: "duotone-dark" },
    { id: 17, text: "duotone-light" },
    { id: 18, text: "eclipse" },
    { id: 19, text: "elegant" },
    { id: 20, text: "erlang-dark" },
    { id: 21, text: "gruvbox-dark" },
    { id: 22, text: "hopscotch" },
    { id: 23, text: "icecoder" },
    { id: 24, text: "idea" },
    { id: 25, text: "isotope" },
    { id: 26, text: "lesser-dark" },
    { id: 27, text: "liquibyte" },
    { id: 28, text: "lucario" },
    { id: 29, text: "material-darker" },
    { id: 30, text: "material-ocean" },
    { id: 31, text: "material-palenight" },
    { id: 32, text: "material" },
    { id: 33, text: "mbo" },
    { id: 34, text: "mdn-like" },
    { id: 35, text: "midnight" },
    { id: 36, text: "monokai" },
    { id: 37, text: "moxer" },
    { id: 38, text: "neat" },
    { id: 39, text: "neo" },
    { id: 40, text: "night" },
    { id: 41, text: "nord" },
    { id: 42, text: "oceanic-next" },
    { id: 43, text: "panda-syntax" },
    { id: 44, text: "paraiso-dark" },
    { id: 45, text: "paraiso-light" },
    { id: 46, text: "pastel-on-dark" },
    { id: 47, text: "railscasts" },
    { id: 48, text: "rubyblue" },
    { id: 50, text: "seti" },
    { id: 51, text: "shadowfox" },
    { id: 52, text: "solarized" },
    { id: 53, text: "ssms" },
    { id: 54, text: "the-matrix" },
    { id: 55, text: "tomorrow-night-bright" },
    { id: 56, text: "tomorrow-night-eighties" },
    { id: 57, text: "ttcn" },
    { id: 58, text: "twilight" },
    { id: 59, text: "vibrant-ink" },
    { id: 60, text: "xq-dark" },
    { id: 61, text: "xq-light" },
    { id: 62, text: "yeti" },
    { id: 63, text: "yonce" },
    { id: 64, text: "zenburn" },
  ]);

  const [fontList, setFontList] = useState([
    { id: 0, text: "Lucida Console" },
    { id: 1, text: "FiraCode" },
    { id: 2, text: "Consolas" },
    { id: 3, text: "Monoid" },
    { id: 4, text: "Press Start 2P", fontFamily: "Press Start" },
    { id: 5, text: "Roboto Mono" },
    { id: 6, text: "Source Code Pro" },
    { id: 7, text: "Sudo" },
    { id: 8, text: "Ubuntu Mono" },
    { id: 9, text: "Courier" },
  ]);

  //editor settings
  const [settings, setSettings] = useState(
    (() => {
      //load user settings
      const userSettings = localStorage.getItem("settings");
      return userSettings != null
        ? JSON.parse(userSettings)
        : {
            fontSize: 16,
            selectedFont: fontList[0],
            selectedDayTheme: themeList[0],
            selectedNightTheme: themeList[21],
            lightMode: false,
          };
    })()
  );

  //state set functions
  const setFontSize = (fontSize) => {
    setSettings({ ...settings, fontSize: fontSize });
  };

  const setSelectedFont = (selectedFont) => {
    setSettings({ ...settings, selectedFont: selectedFont });
  };

  const setSelectedDayTheme = (selectedDayTheme) => {
    setSettings({ ...settings, selectedDayTheme });
  };

  const setSelectedNightTheme = (selectedNightTheme) => {
    setSettings({ ...settings, selectedNightTheme });
  };

  const setLightMode = (lightMode) => {
    setSettings({ ...settings, lightMode: lightMode });
  };

  //TODO: add debounce
  //save user settings to local storage
  useEffect(() => {
    const data = JSON.stringify(settings);
    setInLocalStorage("settings", data, (data) => data);
  }, [settings]);

  const refApp = useRef(null);

  const refreshFileList = useCallback(
    async (initialRun = false) => {
      let fileList = FileSystem.getFileList();
      //remove all files
      const asmFiles = fileList
        .filter((filename) => /.asm$/g.test(filename))
        .map((filename, index) => ({ id: index, filename: filename })); //remove all non .asm files from list
      //.map((filename) => filename.substring(0, filename.length - 4)); //remove .asm
      //set create and set focused file
      if (!fileList || !asmFiles.length) {
        const initialFileName = "test.asm";
        FileSystem.createAssemblyFile(initialFileName, true);
        switchFile(initialFileName);
        fileList = FileSystem.getFileList();
      } else if (initialRun) {
        switchFile(asmFiles[0].filename);
      }

      setFileList(fileList);
    },
    [fileList]
  );

  useEffect(() => {
    const init = async () => {
      await FileSystem.init();
      window.addEventListener("storage", () => {
        refreshFileList();
      });
      refreshFileList(true);
    };
    init();
    return () => {
      window.removeEventListener("storage");
    };
  }, []);

  const handleClick = () => {
    //allow canvas element to know in iframe that editor has been selected so styling can be restored
    postMessage("editor-selected", {});
  };

  //change current file
  const switchFile = (filename) => {
    setFilename(filename);
  };

  const createFile = useCallback(
    (filename) => {
      FileSystem.createAssemblyFile(filename);
      switchFile(filename);
      setTimeout(() => {
        //can probably generify this
        if (!fileList.includes(filename)) {
          postMessage("run-command", { data: `echo.>${filename}` });
          //postMessage("reset", {});
          refreshFileList();
        }
      }, 5000);
    },
    [filename]
  );

  //TODO Throw common props in objects
  return (
    <>
      <div ref={refApp} onClick={handleClick} className="root app-layout">
        <FileDrawer
          fileList={fileList}
          fileSelected={filename}
          switchFile={switchFile}
          createFile={createFile}
          refreshFileList={refreshFileList}
          setEditorLock={setEditorLock}
          forceUpdate={{ refreshFile, setRefreshFile }}
          lightMode={!settings.lightMode} //flip boolean so light is true, dark is false
        />
        <Banner
          //theme variables
          themeList={themeList}
          selectedDayTheme={settings.selectedDayTheme}
          selectedNightTheme={settings.selectedNightTheme}
          setSelectedDayTheme={setSelectedDayTheme}
          setSelectedNightTheme={setSelectedNightTheme}
          lightMode={settings.lightMode}
          setLightMode={setLightMode}
          //font
          fontList={fontList}
          setSelectedFont={setSelectedFont}
          selectedFont={settings.selectedFont}
          fontSize={settings.fontSize}
          setFontSize={setFontSize}
          //file management
          refApp={refApp.current}
          filename={filename}
          fileList={fileList}
        />
        <Editor
          //set theme
          selectedTheme={
            settings.lightMode
              ? settings.selectedNightTheme.text
              : settings.selectedDayTheme.text
          }
          fontSize={settings.fontSize}
          shouldRefreshFile={refreshFile}
          filename={filename}
          disabled={lockEditor}
          selectedFont={settings.selectedFont}
        />
        <CommandPrompt />
      </div>
    </>
  );
}

export default App;
