/*eslint-env node */

const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

const jsConfig = (_env, argv) => {
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

  console.log(">>> Running build in", argv.mode, "mode");
  if (argv.mode === "development") {
    config.devtool = "nosources-source-map";
    config.optimization.minimize = false;
  }

  return config;
};

const path = require('path');

const tsConfig = (_env, argv) => {
  return {
    mode: argv.mode,
    entry: './index.ts',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
      filename: 'behaviors.js',
      path: path.resolve(__dirname, 'dist'),
    },
  }
};

// module.exports = jsConfig;
module.exports = tsConfig;
