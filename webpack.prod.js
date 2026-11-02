const common = require("./webpack.common");
const { merge } = require("webpack-merge");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = merge(common, {
  mode: "production",
  // the inline source map slows every terminal start
  devtool: false,
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
});
