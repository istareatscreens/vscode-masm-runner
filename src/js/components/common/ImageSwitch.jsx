import React, { forwardRef } from "react";

const ImageSwitch = forwardRef(
  ({ className, clickHandler, imgClass, src, ...props }, ref) => {
    return (
      <div className="switch switch__container">
        <input
          ref={ref}
          type="checkbox"
          className={`switch ${className}`}
          {...props}
        />
        <img className={`switch__image ${imgClass}`} src={src}></img>
      </div>
    );
  }
);

export default ImageSwitch;
