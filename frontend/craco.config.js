module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        '@components': `${__dirname}/src/components`,
        '@data': `${__dirname}/src/data`
      };
      return webpackConfig;
    }
  }
};