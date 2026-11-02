import React from "react";
import { createRoot } from "react-dom/client";
import Boxedwine from "./Boxedwine.jsx";
import { startHostLayer } from "./host/controller";

startHostLayer();
const root = createRoot(document.getElementById("bw-root"));
root.render(<Boxedwine />);
