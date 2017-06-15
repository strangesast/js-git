var path = require('path');
var ProvidePlugin = require('webpack').ProvidePlugin;

module.exports = {
  entry: './src/main.ts',
  output: {
    filename: 'dist/main.js',
    library: 'jsgit',
    libraryTarget: 'var'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'jsgit': path.resolve(__dirname, './dist/main.js')
    }
  },
  module: {
    loaders: [
      { test: /\.tsx?$/, loader: 'ts-loader' }
    ]
  },
  plugins: [
    new ProvidePlugin({
      'jsgit': 'jsgit',
      'window.jsgit': 'jsgit'
    })
  ]
};
