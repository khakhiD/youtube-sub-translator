const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    content: './src/content/index.ts',
    background: './src/background/index.ts',
    offscreen: './src/offscreen/offscreen.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'public/icons', to: 'icons', noErrorOnMissing: true },
        { from: 'src/offscreen/offscreen.html', to: 'offscreen.html' },
        // Tesseract.js worker script (offscreen document에서 직접 로드)
        {
          from: 'node_modules/tesseract.js/dist/worker.min.js',
          to: 'tesseract/worker.min.js',
        },
        // Tesseract.js-core WASM files (importScripts로 로드되므로 로컬 필수)
        {
          from: 'node_modules/tesseract.js-core/tesseract-core*.wasm.js',
          to: 'tesseract/core/[name][ext]',
        },
        {
          from: 'node_modules/tesseract.js-core/tesseract-core*.wasm',
          to: 'tesseract/core/[name][ext]',
        },
      ],
    }),
  ],
  // MV3 content script은 eval 사용 불가
  devtool: 'cheap-module-source-map',
};
