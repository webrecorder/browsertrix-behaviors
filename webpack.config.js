/*eslint-env node */

const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = (env, argv) => {
  const config = {
    mode: argv.mode,
    plugins: [
      new webpack.BannerPlugin("behaviors.js is part of Webrecorder project. Copyright (C) 2021, Webrecorder Software. Licensed under the Affero General Public License v3."),
      new webpack.ProgressPlugin()
    ],
    output: {
      iife: true,
      filename: "behaviors.js"
    },
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
        }),
      ],
    }
  };

  console.log(argv.mode);
  if (argv.mode === "development") {
    config.devtool = "nosources-source-map";
    config.optimization.minimize = false;
  }

  return config;
};

