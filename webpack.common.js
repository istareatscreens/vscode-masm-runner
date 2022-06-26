const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: {
    "index-bw": "./src/js/components/boxedwine/index-bw.jsx",
    "index-editor": "./src/js/components/main/index-editor.jsx",
  },
  output: {
    filename: "[name].js",
  },
  devtool: "inline-source-map",
  target: "web",
  module: {
    rules: [
      {
        test: /\.(tsx?|jsx?)$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.(png|jpe?g|svg|gif)$/i,
        use: [
          {
            loader: "file-loader",
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", "jsx"],
  },
};
