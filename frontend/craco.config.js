module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        '@components': 'src/components',
        '@data': 'src/data'
      };
      return webpackConfig;
    }
  }
};