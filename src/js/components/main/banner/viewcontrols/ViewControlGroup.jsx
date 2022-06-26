import React, { useState, useEffect, useRef } from "react";

import Switch from "../../../common/ImageSwitch.jsx";

import filedrawer from "../../../../../images/filedrawer.png";
import zen from "../../../../../images/zen.png";
import cmd from "../../../../../images/cmd.png";
import editor from "../../../../../images/editor.png";

//TODO: Move zen button to main button group on right
//TODO: MODIFY break point size for each view
function ViewControlGroup({ className, refApp, ...props }) {
  const [showCMD, setShowCMD] = useState(true);
  const [showFileDrawer, setShowFileDrawer] = useState(true);
  const [showEditor, setShowEditor] = useState(true);
  const [isZen, setZen] = useState(false);

  const classPrefix = "app-layout";

  const refCMDBtn = useRef(null);

  useEffect(() => {
    window.addEventListener("show-cmd", () => {
      console.log("HERE");
      console.log(refCMDBtn);
      refCMDBtn.current.click();
    });
    return () => {
      window.removeEventListener("show-cmd");
    };
  }, []);

  const getChangedBoolean = (editor, cmd, filedrawer, refCMDBtn) => {
    if (editor != showEditor) {
      return editor;
    } else if (cmd != showCMD) {
      return cmd;
    } else if (filedrawer != showFileDrawer) {
      return filedrawer;
    }
    console.error("Called changeViewState without change of switch variable");
  };

  const handleSwitchChange = (
    setState,
    editor = showEditor,
    cmd = showCMD,
    filedrawer = showFileDrawer
  ) => {
    const changeView = changeViewState(
      setState,
      getChangedBoolean(editor, cmd, filedrawer)
    );

    if ((!editor && !cmd && !filedrawer) || (!editor && !cmd && filedrawer)) {
      //invalid state do nothing
      // 0 0 0 | 0 0 1
      return;
    } else if (editor && cmd && filedrawer) {
      //1 1 1 default
      changeView();
    } else if (!editor && cmd && !filedrawer) {
      //0 1 0 --only-cmd
      changeView("--only-cmd");
    } else if (!editor && cmd && filedrawer) {
      //  0 1 1 --no-editor
      changeView("--no-editor");
    } else if (editor && !cmd && !filedrawer) {
      //1 0 0 --only-editor
      changeView("--only-editor");
    } else if (editor && !cmd && filedrawer) {
      //1 0 1 --no-cmd
      changeView("--no-cmd");
    } else if (editor && cmd && !filedrawer) {
      // 1 1 0 --no-file-drawer
      changeView("--no-file-drawer");
    }
  };

  const changeViewState = (setState, switchValue) => (classModifier = "") => {
    refApp.classList.remove(refApp.classList[2]);
    if (classModifier) {
      if (classModifier == "--only-editor") {
        setZen(true);
      } else {
        setZen(false); //handle change when zen is active
      }
      refApp.classList.add(classPrefix + classModifier);
    } else {
      setZen(false);
    }
    setState(switchValue);
  };

  /* 
Switch table:
    editor | cmd | file drawer
      0 0 0 Not allowed
      0 0 1 Not allowed
      0 1 0 --only-cmd
      0 1 1 --no-editor
      1 0 0 --only-editor
      1 0 1 --no-cmd
      1 1 0 --no-file-drawer
      1 1 1 --default


zen button:
      1 --only-editor
      0 --default

class List
  //"--no-editor"
  //"--no-cmd"
  //"--no-file-drawer"
  //"--only-editor"
  //"--only-cmd"
*/
  const handleSwitchZen = (switchValue) => {
    const changeView = changeViewState(setZen, switchValue);
    if (switchValue) {
      changeView("--only-editor");
      setShowCMD(false);
      setShowEditor(true);
      setShowFileDrawer(false);
    } else {
      changeView("");
      setShowCMD(true);
      setShowEditor(true);
      setShowFileDrawer(true);
    }
  };

  const altPrint = (test, show, hide) => (test ? hide : show);

  return (
    <div className={`${className} `}>
      <Switch
        onChange={(event) => {
          handleSwitchZen(event.target.checked);
        }}
        checked={isZen}
        imgClass={"switch__view--zen"}
        src={zen}
        title={altPrint(isZen, "turn zen mode on", "turn zen mode off")}
      />

      <Switch
        onChange={(event) => {
          handleSwitchChange(
            setShowEditor,
            event.target.checked,
            showCMD,
            showFileDrawer
          );
        }}
        checked={showEditor}
        src={editor}
        imgClass={"switch__view--editor"}
        title={altPrint(showEditor, "hide editor", "show editor")}
      />

      <Switch
        onChange={(event) => {
          handleSwitchChange(
            setShowCMD,
            showEditor,
            event.target.checked,
            showFileDrawer
          );
        }}
        ref={refCMDBtn}
        checked={showCMD}
        src={cmd}
        imgClass={"switch__view--cmd"}
        title={altPrint(showCMD, "hide command prompt", "show command prompt")}
      />
      <Switch
        src={filedrawer}
        checked={showFileDrawer}
        onChange={(event) =>
          handleSwitchChange(
            setShowFileDrawer,
            showEditor,
            showCMD,
            event.target.checked
          )
        }
        imgClass={"switch__view--file-drawer"}
        title={altPrint(
          showFileDrawer,
          "hide file explorer",
          "show file explorer"
        )}
      />
    </div>
  );
}

export default ViewControlGroup;
