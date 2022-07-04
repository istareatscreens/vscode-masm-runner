import React, { useRef } from "react";
import Draggable from "react-draggable";

const Window = ({
  closeWindow,
  windowClass,
  titlebarClass,
  titlebarText,
  children,
}) => {
  const windowRef = useRef(null);
  return (
    <Draggable
      cancel={".no-drag"}
      positionOffset={{ x: "-50%", y: "-50%" }}
      nodeRef={windowRef}
    >
      <div ref={windowRef} className={`window ${windowClass} no-cursor`}>
        <div className={`title-bar ${titlebarClass} cursor `}>
          <div className="title-bar-text">{titlebarText}</div>
          <div className="title-bar-controls no-drag">
            <button
              onClick={closeWindow}
              className={"title-bar__btn btn"}
              aria-label="Close"
            ></button>
          </div>
        </div>
        <div className="window-body no-drag">{children}</div>
      </div>
    </Draggable>
  );
};

export default Window;
