#!/usr/bin/env node
'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _setImmediate2 = require('babel-runtime/core-js/set-immediate');

var _setImmediate3 = _interopRequireDefault(_setImmediate2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var webpack = require('webpack');
var autoprefixer = require('autoprefixer');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var chalk = require('chalk');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var CleanPlugin = require('clean-webpack-plugin');
var InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
var execa = require('execa');

var ProgressBarPlugin = require('progress-bar-webpack-plugin');

var path = require('path');
var fs = require('fs');

var colorSupported = require('supports-color');

var baseFolder = path.resolve('.');
var configPath = path.join(baseFolder, 'config');

var devServer = require('./devServer');

var config = {};

var render = function render(color, content) {
  if (colorSupported) {
    return chalk[color](content);
  }
  return content;
};

process.stderr.write(render('green', 'Start to do job.\n'));

try {
  var c = require(path.join(configPath, 'config.default.js'));
  config = c;
} catch (e) {
  process.stderr.write(render('red', 'The config file is not found or something wrong when compile the config file! You need a config.default.js file under config folder.\n'));

  (0, _setImmediate3.default)(function () {
    return process.exit(1);
  });
}

var env = null;
var args = process.argv.filter(function (arg) {
  return (/^\-\-(.+)\=(.*)/.test(arg)
  );
});
var argObj = {};

args.forEach(function (v) {
  var argv = v.replace(/^\-\-/, '').split('=');
  if (argv.length === 2) {
    argObj[argv[0]] = argv[1];
  }
});

if (argObj.env) {
  env = argObj.env;
}

process.stderr.write(render('green', 'Read the configurations.\n'));
var isDev = env === 'dev';

try {
  if (!env) {
    env = fs.readFileSync(path.join(configPath, 'env'));
    env = env.toString();
  }
  var addFileName = `config.${env}.js`;
  var _c = require(path.join(configPath, addFileName));
  config = (0, _assign2.default)(config, _c);
} catch (e) {}
process.stderr.write(render('green', `The current enviroment is ${env}.\n`));

var sourceFolder = path.join(baseFolder, config.srcFolder || 'src');

if (!process.env.BABEL_ENV) {
  if (isDev) {
    process.env.BABEL_ENV = 'development';
  } else {
    process.env.BABEL_ENV = 'production';
  }
}

/** webpack entry list. */
var entry = {};
if (config.entry && config.entry.entries) {
  entry = (0, _assign2.default)(entry, config.entry.entries);
} else {
  fs.readdirSync(sourceFolder).filter(function (file) {
    file = file.replace(/^(.*)\//, '');
    return fs.statSync(path.join(sourceFolder, file)).isFile() && /\.js(x*)$/.test(file) && (!config.entry || config.entry.exclude.indexOf(file) < 0);
  }).forEach(function (file) {
    entry[file.replace(/\.js(x*)$/, '')] = path.join(sourceFolder, file);
  });
}

var browsers = config.browsers || ['>1%', 'last 4 versions', 'Firefox ESR', 'not ie < 9'];

if ((0, _keys2.default)(entry).length < 1) {
  process.stderr.write(render('red', `You do not have entry files under folder ${sourceFolder}.\n`));

  (0, _setImmediate3.default)(function () {
    return process.exit(1);
  });
}

var includeModules = [];
if (config.compiledNodeModules) {
  includeModules = config.compiledNodeModules.map(function (m) {
    return (
      // path.join(sourceFolder, 'node_modules', m));
      new RegExp(`node_modules/${m}`)
    );
  });
}
var babelConfig = {
  loader: require.resolve('babel-loader'),
  options: {
    presets: [[require.resolve('babel-preset-env'), {
      targets: {
        browsers
      },
      useBuiltIns: true
    }], [require.resolve('babel-preset-react')]],
    plugins: [require.resolve('babel-plugin-transform-class-properties'), require.resolve('babel-plugin-transform-object-rest-spread'), require.resolve('babel-plugin-syntax-dynamic-import'), require.resolve('babel-plugin-transform-runtime'), require.resolve('babel-plugin-transform-decorators-legacy')],
    cacheDirectory: true,
    compact: true
  }
};

if (config.enableDva) {
  babelConfig.options.plugins.push(require.resolve('babel-plugin-dva-hmr'));
}

// Enable babel-loader with React is default.
var babelLoader = {
  test: /\.(js|jsx)$/,
  // exclude: /node_modules/,
  exclude: function exclude(path) {
    if (/node_modules/.test(path)) {
      for (var i = 0; i < includeModules.length; i++) {
        if (includeModules[i].test(path)) {
          return false;
        }
      }
      return true;
    }
    return false;
  },
  use: babelConfig
};

if (config.antd) {
  babelLoader.use.options.plugins.push([require.resolve('babel-plugin-import'), [{
    libraryName: "antd",
    libraryDirectory: "es",
    style: true
  }]]);
}
var rules = [babelLoader];

if (config.less) {
  var use = [{
    loader: require.resolve('css-loader'),
    options: {
      importLoaders: 1,
      sourceMap: isDev || !!config.enableSourceMap,
      minimize: !isDev,
      modules: config.less.enableCSSModule,
      localIdentName: config.less.enableCSSModule ? '[name]__[local]___[hash:base64:5]' : null
    }
  }];

  if (config.less.enablePostCSS) {
    use.push({
      loader: require.resolve('postcss-loader'),
      options: {
        // Necessary for external CSS imports to work
        // https://github.com/facebookincubator/create-react-app/issues/2677
        ident: 'postcss',
        plugins: function plugins() {
          return [require('postcss-flexbugs-fixes'), autoprefixer({
            browsers,
            flexbox: 'no-2009'
          })];
        }
      },
      options: {
        sourceMap: true,
        minimize: false,
        plugins: function plugins() {
          return [autoprefixer];
        }
      }
    });
    use[0].options.importLoaders++;
  }

  var lessOpt = config.less.options || {};
  lessOpt.javascriptEnabled = true;
  use.push({
    loader: require.resolve('less-loader'),
    options: (0, _extends3.default)({}, lessOpt)
  });

  rules.push({
    test: /\.css$/,
    exclude: function exclude(path) {
      if (config.ignoreCSSModule) {
        var reg = new RegExp(config.ignoreCSSModule.join('|'));
        if (reg.test(path)) {
          return true;
        }
      }

      if (config.antd && /antd/.test(path)) {
        return true;
      }

      return (/node_modues/.test(path)
      );
    },
    use: ExtractTextPlugin.extract({
      fallback: require.resolve('style-loader'),
      use: [{
        loader: require.resolve('css-loader'),
        options: {
          importLoaders: 3,
          sourceMap: isDev || !!config.enableSourceMap,
          minimize: !isDev
        }
      }]
    })
  });

  rules.push({
    test: /\.less$/,
    exclude: function exclude(path) {
      if (config.ignoreCSSModule) {
        var reg = new RegExp(config.ignoreCSSModule.join('|'));
        if (reg.test(path)) {
          return true;
        }
      }

      if (config.antd && /antd/.test(path)) {
        return true;
      }

      return (/node_modues/.test(path)
      );
    },
    use: ExtractTextPlugin.extract({
      fallback: require.resolve('style-loader'),
      use
    })
  });

  if (config.antd && config.less.enableCSSModule) {

    // if (config.antd && /antd/.test(path)) {
    //   return true;
    // }

    var r = ['antd'];
    if (config.ignoreCSSModule) {
      r = r.concat(config.ignoreCSSModule);
    }
    rules.push({
      test: /\.less$/,
      include: new RegExp(r.join('|')),
      use: ExtractTextPlugin.extract({
        fallback: require.resolve('style-loader'),
        use: [{
          loader: require.resolve('css-loader'),
          options: {
            importLoaders: 3,
            sourceMap: isDev || !!config.enableSourceMap,
            minimize: !isDev
          }
        }, {
          loader: require.resolve('less-loader'),
          options: {
            modifyVars: config.antd.theme,
            javascriptEnabled: true
          }
        }]
      })
    });
  }
}

var standardName = '[name].[hash:8].[ext]';

if (!!config.ignoreNameHash || isDev) {
  standardName = '[name].[ext]';
}

// "url" loader works like "file" loader except that it embeds assets
// smaller than specified limit in bytes as data URLs to avoid requests.
// A missing `test` is equivalent to a match.
rules.push({
  test: /\.(bmp|gif|jpeg|jpg|png)$/,
  loader: require.resolve('url-loader'),
  options: {
    limit: 10000,
    name: `static/media/${standardName}`

  }
});
rules.push({
  test: /\.(html)$/,
  loader: require.resolve('url-loader'),
  exclude: function exclude(path) {
    var publicPath = config.htmlPath || '/index.html';
    var regExp = new RegExp(publicPath);
    return regExp.test(path);
  },
  options: {
    limit: 100,
    name: `static/html/${standardName}`

  }
});

var fontSettings = config.fontSettings || {};

rules.push({
  test: /\.(woff|svg|eot|ttf|eog)$/,
  loader: require.resolve('url-loader'),
  options: (0, _extends3.default)({
    limit: 10000,
    // Use origin name, add hashes when generating fonts
    name: '[name].[ext]'
  }, fontSettings)
});

/** Init the plugin. */
var plugins = [];

if (config.cleanBeforeBuild) {
  plugins.push(new CleanPlugin([config.targetFolder || 'dist'], {
    root: baseFolder
  }));
}

if (!isDev && !config.ignoreUglify) {
  plugins.push(new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: false,
      // Disabled because of an issue with Uglify breaking seemingly valid code:
      // https://github.com/facebookincubator/create-react-app/issues/2376
      // Pending further investigation:
      // https://github.com/mishoo/UglifyJS2/issues/2011
      comparisons: false
    },
    output: {
      comments: false,
      // Turned on because emoji and regex is not minified properly using default
      // https://github.com/facebookincubator/create-react-app/issues/2488
      ascii_only: true
    },
    parallel: config.uglifyParallel,
    sourceMap: !!config.enableSourceMap
  }));
  plugins.push(new webpack.DefinePlugin({
    'process.env.NODE_ENV': (0, _stringify2.default)('production')
  }));
}

plugins.push(new ExtractTextPlugin({
  filename: !config.ignoreNameHash ? '[name].[hash:8].min.css' : '[name].min.css',
  allChunks: true,
  ignoreOrder: true
}));

if (config.useMoment) {
  plugins.push(new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/));
}

if (config.addtionalPlugins) {
  plugins = plugins.concat(config.addtionalPlugins);
}
var chunksArray = [];
if (exports.chunks && exports.chunks instanceof Array) {
  plugin.push(new webpack.optimize.CommonsChunkPlugin({
    names: exports.chunks
  }));
  chunksArray = exports.chunks;
}
if (config.htmlPath) {
  var htmlPath = path.join(baseFolder, config.htmlPath);
  (0, _keys2.default)(entry).forEach(function (_key) {
    var p = new HtmlWebpackPlugin({
      filename: `${_key}.html`,
      chunks: chunksArray.concat([_key]),
      inject: true,
      template: htmlPath
    });

    if (!isDev) {
      p.minify = {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
      };
    }

    plugins.push(p);
  });
}

var outputFolder = path.join(baseFolder, config.targetFolder || 'dist');
var filename = 'js/[name].[chunkhash:8].min.js';
var chunkFilename = 'js/[name].[chunkhash:8].chunk.min.js';
if (isDev || !!config.ignoreNameHash) {
  filename = 'js/[name].min.js';
  chunkFilename = 'js/[name].chunk.min.js';
}
var fileName = isDev || !!config.ignoreNameHash ? 'js/[name].min.js' : 'js/[name].[chunkhash:8].min.js';
var alias = config.alias || {};

/**
 * Build your webpack
 */
var webpackOpt = {
  // In production, we only want to load the polyfills and the app code.
  bail: true,
  entry,
  output: {
    // The build folder.
    path: outputFolder,
    // Generated JS file names (with nested folders).
    // There will be one main bundle, and one file per asynchronous chunk.
    // We don't currently advertise code splitting but Webpack supports it.
    filename,
    chunkFilename,
    // We inferred the "public path" (such as / or /my-project) from homepage.
    publicPath: config.publicPath || '/'
  },
  resolve: {
    // This allows you to set a fallback for where Webpack should look for modules.
    // We placed these paths second because we want `node_modules` to "win"
    // if there are any conflicts. This matches Node resolution mechanism.
    // https://github.com/facebookincubator/create-react-app/issues/253
    modules: [sourceFolder, path.join(baseFolder, 'node_modules'), path.join(__dirname, '..', 'node_modues'), path.join(baseFolder, 'plugins'), path.join(baseFolder, 'config')].concat(
    // It is guaranteed to exist because we tweak it in `env.js`
    process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter).filter(Boolean) : []),
    // These are the reasonable defaults supported by the Node ecosystem.
    // We also include JSX as a common component filename extension to support
    // some tools, although we do not recommend using it, see:
    // https://github.com/facebookincubator/create-react-app/issues/290
    // `web` extension prefixes have been added for better support
    // for React Native Web.
    extensions: ['.web.js', '.js', '.json', '.web.jsx', '.jsx'],
    alias: (0, _extends3.default)({
      'components': path.join(sourceFolder, path.resolve(`components/index.js`)),
      'assets': path.join(sourceFolder, path.resolve(`assets/`))
    }, alias)
  },
  module: {
    rules
  },
  plugins
};

if (isDev || config.enableSourceMap) {
  webpackOpt.devtool = 'source-map';
}

// for auto refresh browser
var inspectionAddress = config.inspection;

var formatSize = function formatSize(size) {
  if (size <= 0) {
    return "0 bytes";
  }

  var abbreviations = ["bytes", "kB", "MB", "GB"];
  var index = Math.floor(Math.log(size) / Math.log(1000));

  return `${+(size / Math.pow(1000, index)).toPrecision(3)} ${abbreviations[index]}`;
};

var onComplete = function onComplete(err, stats) {
  if (err) {
    console.log(err);
  } else {
    var opt = {
      colors: colorSupported
    };
    var s = stats.toJson(opt);
    s.errors.forEach(function (e) {
      return process.stderr.write(render('red', e));
    });
    s.warnings.forEach(function (e) {
      return process.stderr.write(render('yellow', e));
    });
    process.stderr.write('\n');
    if (stats.hasErrors()) {
      if (!isDev) {
        process.stderr.write(render('red', 'Compile with errors!'));
        (0, _setImmediate3.default)(function () {
          return process.exit(1);
        });
      }
    } else {
      process.stderr.write(render('white', `Hash: ${s.hash}\nTime: ${s.time}ms\n`));
      var data = [["Asset", "Size", "Chunks", "", "", "Chunk Names"]];
      // Print the result:
      s.assets.forEach(function (asset) {
        data.push([asset.name.replace(/.+\//, ''), formatSize(asset.size), asset.chunks.join(', '), asset.emitted ? "[emitted]" : "", asset.isOverSizeLimit ? "[big]" : "", asset.chunkNames.join(", ")]);
      });

      var maxLength = data[0].map(function (v) {
        return 0;
      });
      data.forEach(function (asset) {
        asset.forEach(function (a, index) {
          var length = a.length;
          maxLength[index] = Math.max(maxLength[index], length);
        });
      });

      data.forEach(function (asset) {
        var str = asset.map(function (a, index) {
          var length = a.length;
          var add = maxLength[index] - length;
          return `${a}${Buffer.alloc(add, ' ').toString()}`;
        }).join(' ');

        process.stderr.write(render('green', `${str}\n`));
      });
      process.stderr.write(render('green', 'Build Done!\n'));
    }
    try {
      inspectionAddress && execa.shell('osascript refreshChrome.applescript "' + encodeURI(inspectionAddress) + '"', {
        cwd: __dirname,
        stdio: 'ignore'
      });
    } catch (e) {
      console.log(e);
    }
  }
};

try {
  if (isDev) {
    var defaultLanguage = 'default';
    if (config.i18n && config.i18n.languages && config.i18n.defaultLanguage) {
      defaultLanguage = config.i18n.defaultLanguage;
      webpackOpt.module.rules.push({
        test: /lang.json$/,
        use: [{
          loader: require.resolve('lang-loader'),
          query: {
            language: config.i18n.defaultLanguage
          }
        }, {
          loader: require.resolve('json-loader')
        }]
      });

      (0, _keys2.default)(webpackOpt.resolve.alias).forEach(function (k) {
        webpackOpt.resolve.alias[k] = webpackOpt.resolve.alias[k].replace('${lang}', config.i18n.defaultLanguage);
      });

      webpackOpt.plugins.push(new InterpolateHtmlPlugin({
        language: config.i18n.defaultLanguage
      }), new ProgressBarPlugin());
    }
    var fopt = webpackOpt;
    fopt.mode = 'development';
    fopt.output.path = `${fopt.output.path}/${defaultLanguage}`;
    if (typeof config.beforeBuildHook === 'function') {
      fopt = config.beforeBuildHook(fopt, defaultLanguage);
    }
    var compiler = webpack(fopt);
    devServer(config, webpackOpt);

    var watching = compiler.watch({}, onComplete);

    compiler.hooks.done.tap('remixure', function (stats) {
      process.stderr.write(render('green', 'Compiling...\n'));
    });

    process.stderr.write(render('green', 'Watching Started!\n'));
  } else {

    var doCompile = function doCompile(opt, lang) {
      return new _promise2.default(function (resolve, reject) {

        var fopt = opt;
        if (typeof config.beforeBuildHook === 'function') {
          fopt = config.beforeBuildHook(fopt, lang);
        }
        fopt.mode = 'production';
        var compiler = webpack(fopt);
        compiler.run(function (err, stats) {
          onComplete(err, stats);

          if (err || stats.hasErrors()) {
            reject();
          } else {
            resolve();
          }
        });
        var ProgressPlugin = require('webpack/lib/ProgressPlugin.js');
        compiler.apply(new ProgressPlugin({
          profile: true
        }));
      });
    };

    if (config.i18n && config.i18n.languages) {

      var allDone = [];

      config.i18n.languages.forEach(function (lang) {
        // Loop to set the language.
        var found = null;

        var clone = function clone(obj) {
          if (typeof obj === 'object' && !(obj instanceof RegExp)) {
            if (obj === null) {
              return obj;
            }
            var res = obj instanceof Array ? [] : {};

            if (obj.__proto__ && !(obj instanceof Array)) {
              res.__proto__ = obj.__proto__;
            }
            (0, _keys2.default)(obj).forEach(function (p) {
              res[p] = clone(obj[p]);
            });
            return res;
          }
          return obj;
        };
        var opt = clone(webpackOpt);
        // const opt = {};

        opt.module.rules.push({
          test: /lang.json$/,
          use: [{
            loader: require.resolve('lang-loader'),
            query: {
              language: lang
            }
          }, {
            loader: require.resolve('json-loader')
          }]
        });
        opt.output.filename = filename;
        opt.output.chunkFilename = chunkFilename;
        opt.output.path = `${opt.output.path}/${lang}`;
        opt.plugins.push(new InterpolateHtmlPlugin({
          language: lang
        }), new ProgressBarPlugin());
        (0, _keys2.default)(opt.resolve.alias).forEach(function (k) {
          opt.resolve.alias[k] = opt.resolve.alias[k].replace('${lang}', lang);
        });

        allDone.push(doCompile(opt, lang));
      });

      var p = _promise2.default.all(allDone);

      p.then(function () {
        return console.log('Done');
      });
      p.catch(console.log);
    } else {
      var _p = doCompile(webpackOpt);
      _p.then(function () {
        return console.log('Done');
      });
      _p.catch(console.log);
    }
  }
} catch (e) {
  console.log(e);
}