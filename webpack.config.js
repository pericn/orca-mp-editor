const path = require('path');

module.exports = {
  entry: './node_modules/juice/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'juice',
    libraryTarget: 'window',
  },
  mode: 'production',
  resolve: {
    fallback: {
      fs: require.resolve('browserify-fs'),
      path: require.resolve('path-browserify'),
      url: require.resolve('url/'), // Add polyfill for 'url'
      util: require.resolve('util/'), // Add polyfill for 'util'
      buffer: require.resolve('buffer/'), // Add polyfill for 'buffer'
      stream: require.resolve('stream-browserify'), // Add polyfill for 'stream'
    },
  },
  plugins: [
    new (require('webpack').ProvidePlugin)({
      Buffer: ['buffer', 'Buffer'], // Provide Buffer globally
      process: 'process/browser', // Provide process globally
    }),
  ],
};