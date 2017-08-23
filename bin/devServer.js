'use strict';

const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const chalk = require('chalk');
const clearConsole = require('react-dev-utils/clearConsole');
const errorOverlayMiddleware = require('react-error-overlay/middleware');
const noopServiceWorkerMiddleware = require('react-dev-utils/noopServiceWorkerMiddleware');
const openBrowser = require('react-dev-utils/openBrowser');

const {
  createCompiler,
  prepareUrls,
} = require('react-dev-utils/WebpackDevServerUtils');

/**
 * This code is to handle the dev server logic.
 */
module.exports = (config, webpackOpt) => {
  console.log(config);
  if (!config.devServer) {
    process.stderr.write(chalk.blue('There is no devServer configurations. Ignore...\n'));
    return;
  }
  const protocol = config.devServer.HTTPS ? 'https' : 'http';
  const host = config.devServer.HOST || '0.0.0.0';
  const baseFolder = path.resolve('.');
  const sourceFolder = path.join(baseFolder, (config.srcFolder || 'src'));
  const port = config.devServer.PORT || 8888;

  const urls = prepareUrls(protocol, host, port);

  const opt = {
    disableHostCheck: process.env.DANGEROUSLY_DISABLE_HOST_CHECK === 'true',
    compress: true,
    clientLogLevel: 'none',
    contentBase: sourceFolder,
    watchContentBase: true,
    hot: true,
    publicPath: config.publicPath || '/',
    quiet: true,
    watchOptions: {
      ignored: /node_modules/,
    },
    https: protocol === 'https',
    host: host,
    overlay: false,
    historyApiFallback: {
      // Paths with dots should still use the history fallback.
      // See https://github.com/facebookincubator/create-react-app/issues/387.
      disableDotRule: true,
    },
    public: urls.lanUrlForConfig,
    proxy: {},
    setup(app) {
      // This lets us open files from the runtime error overlay.
      app.use(errorOverlayMiddleware());
      // This service worker file is effectively a 'no-op' that will reset any
      // previous service worker registered for the same host:port combination.
      // We do this in development to avoid hitting the production cache if
      // it used the same host and port.
      // https://github.com/facebookincubator/create-react-app/issues/2272#issuecomment-302832432
      app.use(noopServiceWorkerMiddleware());
    },
  }

  const pkg = require(path.join(baseFolder, 'package.json'));
  const appName = pkg.name;
  const useYarn = fs.existsSync(path.join(baseFolder, 'yarn.lock'));

  const compiler = createCompiler(webpack, webpackOpt, appName, urls, useYarn);

  const devServer = new WebpackDevServer(compiler, opt);
  process.stderr.write(chalk.red('Start dev server.'));
  // Launch WebpackDevServer.
  devServer.listen(port, host, err => {
    if (err) {
      return process.stderr.write(chalk.red(err));
    }
    if (process.stdout.isTTY) {
      clearConsole();
    }
    process.stderr.write(chalk.cyan('Starting the development server...\n'));
    const defaultApp = pkg.default_app || '';
    openBrowser(`${urls.localUrlForBrowser}${defaultApp}`);
  });

  ['SIGINT', 'SIGTERM'].forEach(function(sig) {
    process.on(sig, function() {
      devServer.close();
      process.exit();
    });
  });
};
