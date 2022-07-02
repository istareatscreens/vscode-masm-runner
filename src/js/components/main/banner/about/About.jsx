import React from "react";
import AboutBackground from "./AboutBackground.jsx";
import AboutWindow from "./AboutWindow.jsx";

function About({ closeAbout }) {
  return (
    <>
      <AboutBackground />
      <AboutWindow closeAbout={closeAbout} />
    </>
  );
}

export default About;
