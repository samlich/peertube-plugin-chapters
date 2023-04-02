const path = require('path')

const clientFiles = [
  'video-edit-client-plugin',
  'video-watch-client-plugin'
]

const config = clientFiles.map(f => ({
  // mode: 'production',
  devtool: process.env.NODE_ENV === 'dev' ? 'eval-source-map' : false,
  entry: './client/' + f + '.ts',
  experiments: {
    outputModule: true
  },
  output: {
    path: path.resolve(__dirname, './dist/client'),
    filename: './' + f + '.js',
    library: {
      type: 'module',
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader'
      },
      {
        test: /\.m?js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  resolve: {
    alias: {
      shared: path.resolve(__dirname, 'shared/')
    },
    extensions: ['.ts']
  }
}))

module.exports = config
