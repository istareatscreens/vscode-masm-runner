import React from "react";

/* 
Modified from https://codepen.io/duptitung
https://codepen.io/duptitung/pen/XMVNyZ
*/
const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading">
        <div className="loading__logo">
          <p className="loading__top">MASM</p>
          <p className="loading__mid">
            Runner<span>x86</span>
          </p>
          <p className="loading__bottom">VSCode</p>
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
