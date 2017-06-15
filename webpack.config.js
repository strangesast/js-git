module.exports = {
  entry: './src/main.ts',
  output: {
    filename: 'dist/main.js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    loaders: [
      { test: /\.tsx?$/, loader: 'ts-loader' }
    ]
  }
};
