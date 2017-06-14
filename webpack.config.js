module.exports = {
  entry: './src/main.ts',
  output: {
    filename: 'dist/main.js'
  },
  resolve: {
    extensions: ['.ts']
  },
  module: {
    loaders: [
      { test: /\.tsx?$/, loader: 'ts-loader' }
    ]
  }
};
