'use strict';

const path = require('path');
const autoprefixer = require('autoprefixer');

exports.generatePostCSSRuleObject = () => {
  return {
    loader: require.resolve('postcss-loader'),
    options: {
      sourceMap: true,
      minimize: false,
      plugins: () => {
        return [autoprefixer];
      }
    }
  };
};

exports.generateCSSRuleObject = (config, isDev) => {
  return {
    loader: require.resolve('css-loader'),
    options: {
      importLoaders: 1,
      sourceMap: isDev || !!config.enableSourceMap,
      minimize: !isDev,
      modules: !!config.less.enableCSSModule,
      localIdentName: config.less.enableCSSModule
        ? '[name]__[local]___[hash:base64:5]'
        : null
    }
  };
};

exports.generateDefaultOptions = () => {
  const config = {
    srcFolder: './src',
    publicPath: '/',
    less: { enablePostCSS: true, enableCSSModule: true },
    htmlPath: 'public/index.html',
    cleanBeforeBuild: true,
    compiledNodeModules: [],
    ignoreCSSModule: [],
    i18n: { languages: ['en', 'zh-CN'], defaultLanguage: 'zh-CN' },
    ignoreNameHash: false
  };

  // TODO: Check if we have used antd:
  // const antdMain = require.resolve('antd', {
  //   paths: [path.resolve('.')]
  // });
  // if (antdMain) {
  //   config.antd = { theme: {} };
  // }
  return config;
};
