module.exports = {
  mode: "production",
  entry: { "masm-lezer": "./src/syntax/index.js" },
  target: "node",
  output: {
    filename: "[name].js",
    library: { type: "commonjs2" },
  },
  devtool: false,
  optimization: { minimize: false },
  // the size hints are for browser downloads; this file is read from disk by the extension host
  performance: { hints: false },
};
