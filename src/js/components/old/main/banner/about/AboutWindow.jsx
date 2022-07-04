import React, { useRef } from "react";

import Button from "../../../common/ImageButton.jsx";
import Window from "../../../common/Window.jsx";

import gitHubLogo from "../../../../../images/gitHubLogo.png";
import bmcLogo from "../../../../../images/bmcLogo.svg";

function AboutWindow({ closeAbout }) {
  return (
    <Window
      closeWindow={closeAbout}
      windowClass={"window__about"}
      titlebarClass={"title-bar__about"}
      titlebarText={"WASM MASM x86 Editor Info"}
    >
      <p>
        {
          "WASM MASM x86 Editor uses JWlink and JWasm to compile x86/x64 Microsoft assembly language (MASM) and provides a 32-bit wine terminal to execute x86 code using Boxedwine emscripten port."
        }
      </p>
      <br />
      <p>
        {
          "Irvine library created by Kip Irvine is also included. You can include it with the following line:"
        }
      </p>
      <p>{"INCLUDE D:/irvine/Irvine32.inc"}</p>
      <br></br>
      <p>
        {
          "All user data is stored in local storage. All files can be freely downloaded using the menu buttons."
        }
      </p>
      <br></br>
      <p>
        {
          "Note this app should be considered a work in progress and is not bug free. If you find a bug please feel free to post an issue."
        }
      </p>
      <br></br>
      <p>
        {
          "This program is free software. It comes without any warranty, to the extent permitted by applicable law. I take no responsibility for any loss of work or anything else that results from using this software."
        }
        {
          "Furthermore, this software was not published by, affiliated with or endorsed by Microsoft."
        }
      </p>
      <br></br>
      <div className="external-buttons">
        <Button
          src={gitHubLogo}
          className={"btn--text btn--window btn--window--first"}
          alt={"go to github repository"}
          onClick={() =>
            window.open(
              "https://github.com/istareatscreens/wasm-masm-x86-editor"
            )
          }
        >
          <span>{"Repo"}</span>
        </Button>
        <Button
          src={bmcLogo}
          className={"btn--text btn--window"}
          alt={"buy me a coffee"}
          onClick={() =>
            window.open("https://www.buymeacoffee.com/istareatscreens")
          }
        >
          <span>{"Buy me a coffee"}</span>
        </Button>
      </div>
    </Window>
  );
}

export default AboutWindow;
