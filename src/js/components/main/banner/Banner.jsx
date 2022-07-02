import React, { useState } from "react";
import Button from "../../common/ImageButton.jsx";
import {
  postMessage,
  writeCommandToCMD,
  checkFileExtension,
} from "../../../utility/utilityFunctions.ts";

import buildFile from "../../../../images/buildFile.png";
import cmdReset from "../../../../images/cmdReset.png";
import runBinary from "../../../../images/runBinary.png";
import about from "../../../../images/about.png";

import About from "./about/About.jsx";
import ViewControlGroup from "./viewcontrols/ViewControlGroup.jsx";
import Dropdown from "./../../common/Dropdown.jsx";
//import ThemeControlGroup from "./themecontrols/ThemeControlGroup.jsx";
//import ThemeControlWindow from "./themecontrols/ThemeControlWindow.jsx";

const Banner = function Banner({
  filename,
  refApp,
  fileList,
  //fonts
  fontSize,
  setFontSize,
  selectedFont,
  setSelectedFont,
  fontList,
  //theme
  themeList,
  setLightMode,
  lightMode,
  setSelectedDayTheme,
  setSelectedNightTheme,
  selectedDayTheme,
  selectedNightTheme,
}) {
  const [aboutPageOpened, setAboutPageOpened] = useState(false);
  const [themeSettingsOpened, setThemeSettingsOpened] = useState(false);

  const unhideTerminal = () => {
    if (
      refApp.classList[2] == "app-layout--no-cmd" ||
      refApp.classList[2] == "app-layout--only-editor"
    ) {
      console.log("firing event");
      window.dispatchEvent(new CustomEvent("show-cmd"));
    }
  };

  const build = () => {
    //TODO rework assemble.bat to simplify this logic
    if (/.asm$/.test(filename)) {
      writeCommandToCMD(
        `assemble ${filename.substring(0, filename.length - 4)}`
      );
      unhideTerminal();
    } else {
      console.log("not an assembly file: " + filename);
    }
  };

  //TODO: FIX bug when selecting non asm files
  const getExecutableName = () => {
    return `${filename.substring(0, filename.length - 3)}exe`;
  };

  const checkForFile = () => {
    return !fileList.includes(getExecutableName());
  };

  const reset = () => {
    postMessage("reset", {});
  };

  const run = () => {
    if (/.asm$/.test(filename)) {
      writeCommandToCMD(getExecutableName());
      unhideTerminal();
    }
  };

  const checkIfAsm = () => {
    return !checkFileExtension(".asm", filename);
  };
  const handleFontChange = (event) => {
    setSelectedFont(fontList[event.target.selectedIndex]);
  };

  //TODO: Move props to objects
  return (
    <>
      {aboutPageOpened && (
        <About closeAbout={() => setAboutPageOpened(false)} />
      )}
      {/*
      {themeSettingsOpened && (
        <ThemeControlWindow
          setThemeSettingsOpened={setThemeSettingsOpened}
          themeSettingsOpened={setThemeSettingsOpened}
          themeList={themeList}
          setSelectedDayTheme={setSelectedDayTheme}
          setSelectedNightTheme={setSelectedNightTheme}
          selectedDayTheme={selectedDayTheme}
          selectedNightTheme={selectedNightTheme}
        />
      )}
      */}
      <div className={"banner__patch"} />
      <div className={"banner"} />
      <div className={"banner__main"}>
        <div className={"banner__main__group banner__main__group--start"}>
          <Button
            className={"banner__main__btn"}
            onClick={build}
            title={"compile, link and run .asm file"}
            id={"pushData"}
            disabled={checkIfAsm()}
            src={buildFile}
          />
          <Button
            onClick={run}
            className={"banner__main__btn"}
            title={"run compiled binary"}
            id={"runEXE"}
            disabled={checkForFile()}
            src={runBinary}
          />
          <Button
            title={"reset command prompt"}
            className={"banner__main__btn"}
            onClick={reset}
            id={"resetCMD"}
            src={cmdReset}
          />
          <input
            type="number"
            value={fontSize}
            onChange={(event) => {
              if (event.target.value >= 1) {
                setFontSize(event.target.value);
              }
            }}
            className="input-box input-box--font"
          />
          <Dropdown
            handleChange={(event) => {
              handleFontChange(event);
            }}
            classNameDropdown={""}
            options={fontList}
            selected={selectedFont}
            value={selectedFont}
          />
          {/*
          <ThemeControlGroup
            setThemeSettingsOpened={setThemeSettingsOpened}
            themeSettingsOpened={themeSettingsOpened}
            lightMode={lightMode}
            setLightMode={setLightMode}
          />
          */}
          <ViewControlGroup
            className={"banner__main__group banner__main__group--mid"}
            refApp={refApp}
          />
        </div>
        <div className={"banner__main__group banner__main__group--end"}>
          <Button
            title={"application info"}
            className={"banner__main__btn"}
            onClick={() => setAboutPageOpened(!aboutPageOpened)}
            src={about}
          />
        </div>
      </div>
    </>
  );
};

export default React.memo(Banner);
