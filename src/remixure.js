#!/usr/bin/env node

const webpack = require('webpack');
const autoprefixer = require('autoprefixer');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const chalk = require('chalk');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanPlugin = require('clean-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const {
  generateCSSRuleObject,
  generateDefaultOptions,
  generatePostCSSRuleObject
} = require('./utils/helper');

// TODO: Put it back when react-dev-utils support Webpack 4.
// const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const execa = require('execa');

const ProgressBarPlugin = require('progress-bar-webpack-plugin');

const path = require('path');
const fs = require('fs');

const colorSupported = require('supports-color');

// TODO: Remove me when react-dev-utils support webpack 4.
const escapeStringRegexp = require('escape-string-regexp');

class InterpolateHtmlPlugin {
  constructor(replacements) {
    this.replacements = replacements;
  }

  apply(compiler) {
    compiler.hooks.compilation.tap('InterpolateHtmlPlugin', compilation => {
      compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing.tap(
        'InterpolateHtmlPlugin',
        data => {
          // Run HTML through a series of user-specified string replacements.
          Object.keys(this.replacements).forEach(key => {
            const value = this.replacements[key];
            data.html = data.html.replace(
              new RegExp('%' + escapeStringRegexp(key) + '%', 'g'),
              value
            );
          });
        }
      );
    });
  }
}
// End TODO.

const baseFolder = path.resolve('.');
const configPath = path.join(baseFolder, 'config');
const devServer = require('./devServer');

let config = generateDefaultOptions();

const render = (color, content) => {
  if (colorSupported) {
    return chalk[color](content);
  }
  return content;
};
process.stderr.write(render('green', 'Start to do job.\n'));

try {
  const c = require(path.join(configPath, 'config.default.js'));
  config = Object.assign(config, c);
} catch (e) {
  // The config.default.js does not exist. Ignore it.
}
let env = null;
const args = process.argv.filter(arg => /^\-\-(.+)\=(.*)/.test(arg));
const argObj = {};

args.forEach(v => {
  const argv = v.replace(/^\-\-/, '').split('=');
  if (argv.length === 2) {
    argObj[argv[0]] = argv[1];
  }
});

if (argObj.env) {
  env = argObj.env;
}

process.stderr.write(render('green', 'Read the configurations.\n'));
const isDev = env === 'dev';

try {
  if (!env) {
    env = fs.readFileSync(path.join(configPath, 'env'));
    env = env.toString();
  }
  const addFileName = `config.${env}.js`;
  const c = require(path.join(configPath, addFileName));
  config = Object.assign(config, c);
} catch (e) {}

if (config.ignoreCSSModule && config.ignoreCSSModule.length < 1) {
  delete config.ignoreCSSModule;
}
process.stderr.write(render('green', `The current enviroment is ${env}.\n`));

const sourceFolder = path.join(baseFolder, config.srcFolder || 'src');

if (!process.env.BABEL_ENV) {
  if (isDev) {
    process.env.BABEL_ENV = 'development';
  } else {
    process.env.BABEL_ENV = 'production';
  }
}

/** webpack entry list. */
let entry = {};
if (config.entry && config.entry.entries) {
  entry = Object.assign(entry, config.entry.entries);
} else {
  fs
    .readdirSync(sourceFolder)
    .filter(file => {
      file = file.replace(/^(.*)\//, '');
      return (
        fs.statSync(path.join(sourceFolder, file)).isFile() &&
        /\.js(x*)$/.test(file) &&
        (!config.entry || config.entry.exclude.indexOf(file) < 0)
      );
    })
    .forEach(file => {
      entry[file.replace(/\.js(x*)$/, '')] = path.join(sourceFolder, file);
    });
}

const browsers = config.browsers || [
  '>1%',
  'last 4 versions',
  'Firefox ESR',
  'not ie < 9'
];

if (Object.keys(entry).length < 1) {
  process.stderr.write(
    render('red', `You do not have entry files under folder ${sourceFolder}.\n`)
  );

  setImmediate(() => process.exit(1));
}

let includeModules = [];
if (config.compiledNodeModules) {
  includeModules = config.compiledNodeModules.map(
    m =>
      // path.join(sourceFolder, 'node_modules', m));
      new RegExp(`node_modules/${m}`)
  );
}
const babelConfig = {
  loader: require.resolve('babel-loader'),
  options: {
    presets: [
      [
        require.resolve('babel-preset-env'),
        {
          targets: {
            browsers
          },
          modules: false,
          useBuiltIns: true
        }
      ],
      [require.resolve('babel-preset-react')]
    ],
    plugins: [
      require.resolve('babel-plugin-transform-decorators-legacy'),
      require.resolve('babel-plugin-transform-class-properties'),
      require.resolve('babel-plugin-transform-object-rest-spread'),
      require.resolve('babel-plugin-syntax-dynamic-import'),
      require.resolve('babel-plugin-transform-runtime')
    ],
    cacheDirectory: true,
    compact: true
  }
};

if (config.enableDva) {
  babelConfig.options.plugins.push(require.resolve('babel-plugin-dva-hmr'));
}

// Enable babel-loader with React is default.
const babelLoader = {
  test: /\.(js|jsx)$/,
  // exclude: /node_modules/,
  exclude: path => {
    if (/node_modules/.test(path)) {
      for (let i = 0; i < includeModules.length; i++) {
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
  babelLoader.use.options.plugins.push([
    require.resolve('babel-plugin-import'),
    [
      {
        libraryName: 'antd',
        libraryDirectory: 'es',
        style: true
      }
    ]
  ]);
}
const rules = [babelLoader];

if (config.less) {
  const use = [generateCSSRuleObject(config, isDev)];

  if (config.less.enablePostCSS) {
    use.push(generatePostCSSRuleObject());
    use[0].options.importLoaders++;
  }

  const lessOpt = config.less.options || {};
  lessOpt.javascriptEnabled = true;
  use.push({
    loader: require.resolve('less-loader'),
    options: {
      ...lessOpt
    }
  });

  rules.push({
    test: /\.css$/,
    exclude: path => {
      if (config.ignoreCSSModule) {
        const reg = new RegExp(config.ignoreCSSModule.join('|'));
        if (reg.test(path)) {
          return true;
        }
      }

      if (config.antd && /antd/.test(path)) {
        return true;
      }

      return /node_modues/.test(path);
    },
    use: [MiniCssExtractPlugin.loader, generateCSSRuleObject(config, isDev)]
  });

  rules.push({
    test: /\.less$/,
    exclude: path => {
      if (config.ignoreCSSModule) {
        const reg = new RegExp(config.ignoreCSSModule.join('|'));
        if (reg.test(path)) {
          return true;
        }
      }

      if (config.antd && /antd/.test(path)) {
        return true;
      }

      return /node_modues/.test(path);
    },
    use: [MiniCssExtractPlugin.loader, ...use]
  });

  if (config.antd && config.less.enableCSSModule) {
    // if (config.antd && /antd/.test(path)) {
    //   return true;
    // }

    let r = ['antd'];
    if (config.ignoreCSSModule) {
      r = r.concat(config.ignoreCSSModule);
    }
    rules.push({
      test: /\.less$/,
      include: new RegExp(r.join('|')),
      use: [MiniCssExtractPlugin.loader, ...use]
    });
  }
}

let standardName = '[name].[hash:8].[ext]';

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
  exclude: path => {
    const publicPath = config.htmlPath || '/index.html';
    const regExp = new RegExp(publicPath);
    return regExp.test(path);
  },
  options: {
    limit: 100,
    name: `static/html/${standardName}`
  }
});

const fontSettings = config.fontSettings || {};

rules.push({
  test: /\.(woff|svg|eot|ttf|eog)$/,
  loader: require.resolve('url-loader'),
  options: {
    limit: 10000,
    // Use origin name, add hashes when generating fonts
    name: '[name].[ext]',
    ...fontSettings
  }
});

/** Init the plugin. */
let plugins = [];

if (config.cleanBeforeBuild) {
  plugins.push(
    new CleanPlugin([config.targetFolder || 'dist'], {
      root: baseFolder
    })
  );
}

const optimization = {};

if (!isDev && !config.ignoreUglify) {
  optimization.minimizer = [
    new UglifyJsPlugin({
      cache: true,
      parallel: !!config.uglifyParallel,
      uglifyOptions: {
        compress: false
      },
      sourceMap: !!config.enableSourceMap
    })
  ];
  plugins.push(
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  );
}

plugins.push(
  new MiniCssExtractPlugin({
    // Options similar to the same options in webpackOptions.output
    // both options are optional
    filename: '[name].css',
    chunkFilename: '[id].css'
  })
);

if (config.useMoment) {
  plugins.push(new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/));
}

if (config.addtionalPlugins) {
  plugins = plugins.concat(config.addtionalPlugins);
}
let chunksArray = [];
if (config.chunks && config.chunks instanceof Array) {
  plugins.push(
    new webpack.optimize.CommonsChunkPlugin({
      names: config.chunks
    })
  );
  chunksArray = config.chunks;
}
if (config.htmlPath) {
  const htmlPath = path.join(baseFolder, config.htmlPath);
  Object.keys(entry).forEach(_key => {
    const p = new HtmlWebpackPlugin({
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

const outputFolder = path.join(baseFolder, config.targetFolder || 'dist');
let filename = 'js/[name].[chunkhash:8].min.js';
let chunkFilename = 'js/[name].[chunkhash:8].chunk.min.js';
if (isDev || !!config.ignoreNameHash) {
  filename = 'js/[name].min.js';
  chunkFilename = 'js/[name].chunk.min.js';
}
const fileName =
  isDev || !!config.ignoreNameHash
    ? 'js/[name].min.js'
    : 'js/[name].[chunkhash:8].min.js';
const alias = config.alias || {};

/**
 * Build your webpack
 */
const webpackOpt = {
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
    modules: [
      sourceFolder,
      path.join(baseFolder, 'node_modules'),
      path.join(__dirname, '..', 'node_modues'),
      path.join(baseFolder, 'plugins'),
      path.join(baseFolder, 'config')
    ].concat(
      // It is guaranteed to exist because we tweak it in `env.js`
      process.env.NODE_PATH
        ? process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
        : []
    ),
    // These are the reasonable defaults supported by the Node ecosystem.
    // We also include JSX as a common component filename extension to support
    // some tools, although we do not recommend using it, see:
    // https://github.com/facebookincubator/create-react-app/issues/290
    // `web` extension prefixes have been added for better support
    // for React Native Web.
    extensions: ['.web.js', '.js', '.json', '.web.jsx', '.jsx'],
    alias: {
      components: path.join(sourceFolder, path.resolve(`components/index.js`)),
      assets: path.join(sourceFolder, path.resolve(`assets/`)),
      ...alias
    }
  },
  module: {
    rules
  },
  plugins,
  optimization
};

if (isDev || config.enableSourceMap) {
  webpackOpt.devtool = 'source-map';
}

// for auto refresh browser
const inspectionAddress = config.inspection;

const formatSize = size => {
  if (size <= 0) {
    return '0 bytes';
  }

  const abbreviations = ['bytes', 'kB', 'MB', 'GB'];
  const index = Math.floor(Math.log(size) / Math.log(1000));

  return `${+(size / Math.pow(1000, index)).toPrecision(3)} ${
    abbreviations[index]
  }`;
};

const onComplete = (err, stats) => {
  if (err) {
    console.log(err);
  } else {
    const opt = {
      colors: colorSupported
    };
    const s = stats.toJson(opt);
    s.errors.forEach(e => process.stderr.write(render('red', e)));
    s.warnings.forEach(e => process.stderr.write(render('yellow', e)));
    process.stderr.write('\n');
    if (stats.hasErrors()) {
      if (!isDev) {
        process.stderr.write(render('red', 'Compile with errors!'));
        setImmediate(() => process.exit(1));
      }
    } else {
      process.stderr.write(
        render('white', `Hash: ${s.hash}\nTime: ${s.time}ms\n`)
      );
      const data = [['Asset', 'Size', 'Chunks', '', '', 'Chunk Names']];
      // Print the result:
      s.assets.forEach(asset => {
        data.push([
          asset.name.replace(/.+\//, ''),
          formatSize(asset.size),
          asset.chunks.join(', '),
          asset.emitted ? '[emitted]' : '',
          asset.isOverSizeLimit ? '[big]' : '',
          asset.chunkNames.join(', ')
        ]);
      });

      let maxLength = data[0].map(v => 0);
      data.forEach(asset => {
        asset.forEach((a, index) => {
          const length = a.length;
          maxLength[index] = Math.max(maxLength[index], length);
        });
      });

      data.forEach(asset => {
        const str = asset
          .map((a, index) => {
            const length = a.length;
            let add = maxLength[index] - length;
            return `${a}${Buffer.alloc(add, ' ').toString()}`;
          })
          .join(' ');

        process.stderr.write(render('green', `${str}\n`));
      });
      process.stderr.write(render('green', 'Build Done!\n'));
    }
    try {
      inspectionAddress &&
        execa.shell(
          'osascript refreshChrome.applescript "' +
            encodeURI(inspectionAddress) +
            '"',
          {
            cwd: __dirname,
            stdio: 'ignore'
          }
        );
    } catch (e) {
      console.log(e);
    }
  }
};

try {
  if (isDev) {
    let defaultLanguage = 'default';
    if (config.i18n && config.i18n.languages && config.i18n.defaultLanguage) {
      defaultLanguage = config.i18n.defaultLanguage;
      webpackOpt.module.rules.push({
        test: /lang.json$/,
        use: [
          {
            loader: require.resolve('lang-loader'),
            query: {
              language: config.i18n.defaultLanguage
            }
          }
        ]
      });

      Object.keys(webpackOpt.resolve.alias).forEach(k => {
        webpackOpt.resolve.alias[k] = webpackOpt.resolve.alias[k].replace(
          '${lang}',
          config.i18n.defaultLanguage
        );
      });

      webpackOpt.plugins.push(
        new InterpolateHtmlPlugin({
          language: config.i18n.defaultLanguage
        }),
        new ProgressBarPlugin()
      );
    }
    let fopt = webpackOpt;
    fopt.mode = 'development';
    fopt.output.path = `${fopt.output.path}/${defaultLanguage}`;
    if (typeof config.beforeBuildHook === 'function') {
      fopt = config.beforeBuildHook(fopt, defaultLanguage);
    }
    const compiler = webpack(fopt);
    devServer(config, webpackOpt);

    const watching = compiler.watch({}, onComplete);

    compiler.hooks.done.tap('remixure', stats => {
      process.stderr.write(render('green', 'Compiling...\n'));
    });

    process.stderr.write(render('green', 'Watching Started!\n'));
  } else {
    const doCompile = (opt, lang) => {
      return new Promise((resolve, reject) => {
        let fopt = opt;
        if (typeof config.beforeBuildHook === 'function') {
          fopt = config.beforeBuildHook(fopt, lang);
        }
        fopt.mode = 'production';
        const compiler = webpack(fopt);
        compiler.run((err, stats) => {
          onComplete(err, stats);

          if (err || stats.hasErrors()) {
            reject();
          } else {
            resolve();
          }
        });
        const ProgressPlugin = require('webpack/lib/ProgressPlugin.js');
        compiler.apply(
          new ProgressPlugin({
            profile: true
          })
        );
      });
    };

    if (config.i18n && config.i18n.languages) {
      const allDone = [];

      config.i18n.languages.forEach(lang => {
        // Loop to set the language.
        let found = null;

        const clone = obj => {
          if (typeof obj === 'object' && !(obj instanceof RegExp)) {
            if (obj === null) {
              return obj;
            }
            const res = obj instanceof Array ? [] : {};

            if (obj.__proto__ && !(obj instanceof Array)) {
              res.__proto__ = obj.__proto__;
            }
            Object.keys(obj).forEach(p => {
              res[p] = clone(obj[p]);
            });
            return res;
          }
          return obj;
        };
        const opt = clone(webpackOpt);
        // const opt = {};

        opt.module.rules.push({
          test: /lang.json$/,
          use: [
            {
              loader: require.resolve('lang-loader'),
              query: {
                language: lang
              }
            }
          ]
        });
        opt.output.filename = filename;
        opt.output.chunkFilename = chunkFilename;
        opt.output.path = `${opt.output.path}/${lang}`;
        opt.plugins.push(
          new InterpolateHtmlPlugin({
            language: lang
          }),
          new ProgressBarPlugin()
        );
        Object.keys(opt.resolve.alias).forEach(k => {
          opt.resolve.alias[k] = opt.resolve.alias[k].replace('${lang}', lang);
        });

        allDone.push(doCompile(opt, lang));
      });

      const p = Promise.all(allDone);

      p.then(() => console.log('Done'));
      p.catch(console.log);
    } else {
      const p = doCompile(webpackOpt);
      p.then(() => console.log('Done'));
      p.catch(console.log);
    }
  }
} catch (e) {
  console.log(e);
}
