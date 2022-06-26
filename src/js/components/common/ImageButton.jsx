import React from "react";

function ImageButton({ src, imageClass, className, children, ...props }) {
  return (
    <button className={`btn ${className}`} {...props}>
      <img className={`btn__img ${imageClass}`} src={src} />
      {children}
    </button>
  );
}

export default ImageButton;
