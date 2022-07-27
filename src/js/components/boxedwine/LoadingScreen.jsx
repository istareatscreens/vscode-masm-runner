import React from "react";
import masmwatch from "../../../images/masmwatch.png";

/* 
Modified from https://codepen.io/duptitung
https://codepen.io/duptitung/pen/XMVNyZ
*/
const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading">
        <div className="loading__logo">
          <div className="logo">
            <img className="logo__image" src={masmwatch} />
            <p className="logo__top">MASM</p>
            <p className="logo__mid">Runner</p>
            <p className="logo__bottom">VSCode</p>
            <span className="logo__x86">x86</span>
          </div>
        </div>
        <div className="loading__container">
          <div className="loading__container__box"></div>
          <div className="loading__container__box"></div>
          <div className="loading__container__box"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
