/*eslint-env node */

const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

const path = require("path");

const tsConfig = (_env, argv) => {
  return {
    mode: argv.mode,
    plugins: [
      new webpack.BannerPlugin(`behaviors.js is part of Webrecorder project. Copyright (C) 2021-${new Date().getFullYear()}, Webrecorder Software. Licensed under the Affero General Public License v3.`),
      new webpack.ProgressPlugin(),
      new webpack.optimize.LimitChunkCountPlugin({maxChunks: 1})
    ],
    entry: "./index.ts",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    output: {
      filename: "behaviors.js",
      path: path.resolve(__dirname, "dist"),
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
};

// module.exports = jsConfig;
module.exports = tsConfig;
