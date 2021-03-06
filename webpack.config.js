const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  plugins: [new webpack.ProgressPlugin()],
  output: {
    iife: true,
    filename: 'behaviors.js'
  },
}
