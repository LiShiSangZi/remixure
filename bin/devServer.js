'use strict';

var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var chalk = require('chalk');
var clearConsole = require('react-dev-utils/clearConsole');
var errorOverlayMiddleware = require('react-dev-utils/errorOverlayMiddleware');
var noopServiceWorkerMiddleware = require('react-dev-utils/noopServiceWorkerMiddleware');
var openBrowser = require('react-dev-utils/openBrowser');

var _require = require('react-dev-utils/WebpackDevServerUtils'),
    createCompiler = _require.createCompiler,
    prepareUrls = _require.prepareUrls;

/**
 * This code is to handle the dev server logic.
 */


module.exports = function (config, webpackOpt) {
  if (!config.devServer) {
    process.stderr.write(chalk.blue('There is no devServer configurations. Ignore...\n'));
    return;
  }
  var protocol = config.devServer.HTTPS ? 'https' : 'http';
  var host = config.devServer.HOST || '0.0.0.0';
  var baseFolder = path.resolve('.');
  var sourceFolder = path.join(baseFolder, config.srcFolder || 'src');
  var port = config.devServer.PORT || 8888;

  var urls = prepareUrls(protocol, host, port);

  var opt = {
    disableHostCheck: process.env.DANGEROUSLY_DISABLE_HOST_CHECK === 'true',
    compress: true,
    clientLogLevel: 'none',
    contentBase: sourceFolder,
    watchContentBase: true,
    hot: true,
    publicPath: config.publicPath || '/',
    quiet: true,
    watchOptions: {
      ignored: /node_modules/
    },
    https: protocol === 'https',
    host: host,
    overlay: false,
    historyApiFallback: {
      // Paths with dots should still use the history fallback.
      // See https://github.com/facebookincubator/create-react-app/issues/387.
      disableDotRule: true
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
    }
  };

  var pkg = require(path.join(baseFolder, 'package.json'));
  var appName = pkg.name;
  var useYarn = fs.existsSync(path.join(baseFolder, 'yarn.lock'));

  var compiler = createCompiler(webpack, webpackOpt, appName, urls, useYarn);

  var devServer = new WebpackDevServer(compiler, opt);
  process.stderr.write(chalk.red('Start dev server.'));
  // Launch WebpackDevServer.
  devServer.listen(port, host, function (err) {
    if (err) {
      return process.stderr.write(chalk.red(err));
    }
    if (process.stdout.isTTY) {
      clearConsole();
    }
    process.stderr.write(chalk.cyan('Starting the development server...\n'));
    var defaultApp = pkg.default_app || '';
    openBrowser(`${urls.localUrlForBrowser}${defaultApp}`);
  });

  ['SIGINT', 'SIGTERM'].forEach(function (sig) {
    process.on(sig, function () {
      devServer.close();
      process.exit();
    });
  });
};