import React from "react";
import Window from "../../../common/Window.jsx";
import Dropdown from "../../../common/Dropdown.jsx";
import Button from "../../../common/ImageButton.jsx";

import sun from "../../../../../images/sun.png";
import moon from "../../../../../images/moon.png";
import accept from "../../../../../images/accept.png";

function ThemeControlWindow({
  themeList,
  setSelectedNightTheme,
  setSelectedDayTheme,
  selectedNightTheme,
  selectedDayTheme,
  setThemeSettingsOpened,
}) {
  return (
    <Window
      closeWindow={() => setThemeSettingsOpened(false)}
      windowClass={""}
      titlebarClass={"Editor Theme Settings"}
      titlebarText={"Theme Options"}
    >
      <div className="window-body--list">
        <div className="window-body--element">
          <img className="image--dropdown-icon" src={sun} />
          <Dropdown
            options={themeList}
            selected={selectedDayTheme}
            classNameDropdown={""}
            handleChange={(event) =>
              setSelectedDayTheme(themeList[event.target.selectedIndex])
            }
          />
        </div>
        <div className="window-body--element">
          <img src={moon} className="image--dropdown-icon" />
          <Dropdown
            options={themeList}
            selected={selectedNightTheme}
            classNameDropdown={""}
            handleChange={(event) =>
              setSelectedNightTheme(themeList[event.target.selectedIndex])
            }
          />
        </div>
        <Button
          src={accept}
          className={"btn btn--window btn--createFile"}
          imageClass={"btn--window--image"}
          title="close window"
          onClick={() => setThemeSettingsOpened(false)}
        />
      </div>
    </Window>
  );
}

export default ThemeControlWindow;
