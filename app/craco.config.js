module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.module.rules.push({
        test: /\.wasm$/,
        type: "javascript/auto",
        loader: "file-loader",
        options: {
          name: "[name].[hash].[ext]",
          outputPath: "static/wasm/",
        },
      });

      // Suppress source map warnings for problematic packages
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /superstruct/,
      ];

      return webpackConfig;
    },
  },
};
