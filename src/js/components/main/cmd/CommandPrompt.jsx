import React from "react";
import Iframe from "./Iframe.jsx";

import React from "react";

const CommandPrompt = () => (
  <Iframe
    onInferredClick={(e) => {}}
    className="boxedwine"
    id="boxedwine"
    width="100%"
    height="100%"
    src="boxedwine.html"
    sandbox="allow-scripts allow-same-origin"
    border="none"
  ></Iframe>
);

export default React.memo(CommandPrompt);
