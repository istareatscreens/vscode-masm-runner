import React from "react";
import masmwatch from "../../../images/masmwatch.png";

/* 
Modified from https://codepen.io/duptitung
https://codepen.io/duptitung/pen/XMVNyZ
*/
const LoadingScreen = () => {
  return (
    <div class="loading-screen">
      <div class="loading">
        <div class="loading__logo">
          <div class="logo">
            <img className="logo__image" src={masmwatch} />
            <p class="logo__top">MASM</p>
            <p class="logo__mid">Runner</p>
            <p class="logo__bottom">VSCode</p>
            <span class="logo__x86">x86</span>
          </div>
        </div>
        <div class="loading__container">
          <div class="loading__container__box"></div>
          <div class="loading__container__box"></div>
          <div class="loading__container__box"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
