#!/usr/bin/env node

const webpack = require('webpack');
const autoprefixer = require('autoprefixer');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const chalk = require('chalk');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanPlugin = require('clean-webpack-plugin');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');

const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');

const path = require('path');
const fs = require('fs');

const colorSupported = require('supports-color');

const baseFolder = path.resolve('.');
const configPath = path.join(baseFolder, 'config');

const devServer = require('./devServer');

let config = {};

const render = (color, content) => {
  if (colorSupported) {
    return chalk[color](content);
  }
  return content;
}

process.stderr.write(render('green', 'Start to do job.\n'));

try {
  const c = require(path.join(configPath, 'config.default.js'));
  config = c;
} catch (e) {
  process.stderr.write(render('red', 'The config file is not found! You need a config.default.js file under config folder.\n'));

  setImmediate(() => process.exit(1));
  return;
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
} catch (e) {

}
process.stderr.write(render('green', `The current enviroment is ${env}.\n`));

const sourceFolder = path.join(baseFolder, (config.srcFolder || 'src'));

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
  entry = config.entry.entries;
} else {
  fs.readdirSync(sourceFolder).filter(file => {
    return fs.statSync(path.join(sourceFolder, file)).isFile() && /\.js(x*)$/.test(file) && (!config.entry || config.entry.exclude.indexOf(file) < 0);
  }).forEach(file => {
    entry[file.replace(/\.js(x*)$/, '')] = path.join(sourceFolder, file);
  });
}

if (Object.keys(entry).length < 1) {
  process.stderr.write(render('red', `You do not have entry files under folder ${sourceFolder}.\n`));

  setImmediate(process.exit(1));
  return;
}
if(Object.keys(entry).some(_key => _key === 'polyfills')) {
  process.stderr.write(render('red', `"polyfills" entry already exists.\n`));

  setImmediate(process.exit(1));
  return;
}

let includeModules = [];
if (config.compiledNodeModules) {
  includeModules = config.compiledNodeModules.map(m =>
    // path.join(sourceFolder, 'node_modules', m));
    new RegExp(`node_modules/${m}`));
}
const babelConfig = {
  loader: require.resolve('babel-loader'),
  options: {
    presets: [
      require.resolve('babel-preset-react-app'),
    ],
    plugins: [],
    compact: true,
  },
};

// Enable babel-loader with React is default.
const babelLoader = {
  test: /\.(js|jsx)$/,
  // exclude: /node_modules/,
  exclude: (path) => {
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
  use: babelConfig,
};

if (config.antd) {
  babelLoader.use.options.plugins.push([require.resolve('babel-plugin-import'), [{
    libraryName: "antd",
    style: true
  }]]);
}
const rules = [babelLoader];

if (config.less) {
  const use = [{
    loader: require.resolve('css-loader'),
    options: {
      importLoaders: 1,
      sourceMap: isDev,
      minimize: !isDev,
      modules: config.less.enableCSSModule,
      localIdentName: config.less.enableCSSModule ? '[name]__[local]___[hash:base64:5]' : null,
    }
  }];

  if (config.less.enablePostCSS) {
    use.push({
      loader: require.resolve('postcss-loader'),
      options: {
        // Necessary for external CSS imports to work
        // https://github.com/facebookincubator/create-react-app/issues/2677
        ident: 'postcss',
        plugins: () => [
          require('postcss-flexbugs-fixes'),
          autoprefixer({
            browsers: [
              '>1%',
              'last 4 versions',
              'Firefox ESR',
              'not ie < 9', // React doesn't support IE8 anyway
            ],
            flexbox: 'no-2009',
          }),
        ],
      },
      options: {
        sourceMap: true,
        minimize: false,
        plugins: () => {
          return [autoprefixer];
        }
      }
    });
    use[0].options.importLoaders++;
  }

  use.push({
    loader: require.resolve('less-loader'),
    options: {},
  });

  rules.push({
    test: /\.less$/,
    exclude: (path) => {

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
    use: ExtractTextPlugin.extract({
      fallback: require.resolve('style-loader'),
      use,
    }),
  });

  if (config.antd && config.less.enableCSSModule) {

    if (config.antd && /antd/.test(path)) {
      return true;
    }

    let r = ['antd'];
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
              sourceMap: isDev,
              minimize: !isDev,
            }
          },
          {
            loader: require.resolve('less-loader'),
            options: {
              modifyVars: config.antd.theme,
            },
          },
        ],
      }),
    });
  }
}
// "url" loader works like "file" loader except that it embeds assets
// smaller than specified limit in bytes as data URLs to avoid requests.
// A missing `test` is equivalent to a match.
rules.push({
  test: /\.(bmp|gif|jpeg|jpg|png)$/,
  loader: require.resolve('url-loader'),
  options: {
    limit: 10000,
    name: 'static/media/[name].[hash:8].[ext]',
  },
});
rules.push({
  test: /\.(html)$/,
  loader: require.resolve('url-loader'),
  exclude: (path) => {
    const public = config.htmlPath || '/index.html';
    const regExp = new RegExp(public);
    return regExp.test(path);
  },
  options: {
    limit: 100,
    name: 'static/html/[name].[hash:8].[ext]',
  },
});

rules.push({
  test: /\.(woff|svg|eot|ttf|eog)$/,
  loader: require.resolve('url-loader'),
  options: {
    limit: 10000,
    // Use origin name, add hashes when generating fonts
    name: 'static/font/[name].[ext]',
  },
});

/** Init the plugin. */
const plugins = [];

if (config.cleanBeforeBuild) {
  plugins.push(
    new CleanPlugin([config.targetFolder || 'dist'], {
      root: baseFolder
    })
  );
}

if (!isDev && !config.ignoreUglify) {
  plugins.push(new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: false,
      // Disabled because of an issue with Uglify breaking seemingly valid code:
      // https://github.com/facebookincubator/create-react-app/issues/2376
      // Pending further investigation:
      // https://github.com/mishoo/UglifyJS2/issues/2011
      comparisons: false,
    },
    output: {
      comments: false,
      // Turned on because emoji and regex is not minified properly using default
      // https://github.com/facebookincubator/create-react-app/issues/2488
      ascii_only: true,
    },
    sourceMap: false,
  }));
}

plugins.push(new ExtractTextPlugin({
  filename: '[name].min.css',
  allChunks: true,
  ignoreOrder: true,
}));

if (exports.useMoment) {
  plugins.push(new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/));
}
const chunksArray = [];
if (exports.chunks && exports.chunks instanceof Array) {
  plugin.push(new webpack.optimize.CommonsChunkPlugin({
    names: exports.chunks,
  }));
  chunksArray = exports.chunks;
}
if (config.htmlPath) {
  const htmlPath = path.join(baseFolder, config.htmlPath);
  Object.keys(entry).forEach(_key => {
    const p = new HtmlWebpackPlugin({
      filename: `${_key}.html`,
      chunks: chunksArray.concat([_key]),
      inject: true,
      template: htmlPath,
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
        minifyURLs: true,
      }
    }

    plugins.push(p);
  });
}

const outputFolder = path.join(baseFolder, (config.targetFolder || 'dist'));
const fileName = (isDev) ? './js/[name].min.js' : './js/[name].[chunkhash:8].min.js';
const alias = config.alias || {};
/**
 * Build your webpack
 */
const webpackOpt = {
  // In production, we only want to load the polyfills and the app code.
  bail: true,
  entry: Object.assign(entry, {polyfills: require.resolve('./polyfills')}),
  output: {
    // The build folder.
    path: outputFolder,
    // Generated JS file names (with nested folders).
    // There will be one main bundle, and one file per asynchronous chunk.
    // We don't currently advertise code splitting but Webpack supports it.
    filename: './js/[name].[chunkhash:8].min.js',
    chunkFilename: './js/[name].[chunkhash:8].chunk.min.js',
    // We inferred the "public path" (such as / or /my-project) from homepage.
    publicPath: config.publicPath || '/',
  },
  resolve: {
    // This allows you to set a fallback for where Webpack should look for modules.
    // We placed these paths second because we want `node_modules` to "win"
    // if there are any conflicts. This matches Node resolution mechanism.
    // https://github.com/facebookincubator/create-react-app/issues/253
    modules: [sourceFolder, path.join(baseFolder, 'node_modules'), path.join(__dirname, '..', 'node_modues'), path.join(baseFolder, 'plugins'), path.join(baseFolder, 'config')].concat(
      // It is guaranteed to exist because we tweak it in `env.js`
      process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter).filter(Boolean) : []
    ),
    // These are the reasonable defaults supported by the Node ecosystem.
    // We also include JSX as a common component filename extension to support
    // some tools, although we do not recommend using it, see:
    // https://github.com/facebookincubator/create-react-app/issues/290
    // `web` extension prefixes have been added for better support
    // for React Native Web.
    extensions: ['.web.js', '.js', '.json', '.web.jsx', '.jsx'],
    alias: {
      'components': path.join(sourceFolder, path.resolve(`components/index.js`)),
      'assets': path.join(sourceFolder, path.resolve(`assets/`)),
      ...alias,
    }
  },
  module: {
    rules,
  },
  plugins,
};

if (isDev) {
  webpackOpt.devtool = 'source-map';
}

const formatSize = size => {
  if (size <= 0) {
    return "0 bytes";
  }

  const abbreviations = ["bytes", "kB", "MB", "GB"];
  const index = Math.floor(Math.log(size) / Math.log(1000));

  return `${+(size / Math.pow(1000, index)).toPrecision(3)} ${abbreviations[index]}`;
};

const onComplete = (err, stats) => {
  if (err) {
    console.log(err);
  } else {
    const opt = {
      colors: colorSupported,
    }
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
      process.stderr.write(render('white', `Hash: ${s.hash}\nTime: ${s.time}ms\n`));
      const data = [
        ["Asset", "Size", "Chunks", "", "", "Chunk Names"]
      ];
      // Print the result:
      s.assets.forEach(asset => {
        data.push([
          asset.name.replace(/.+\//, ''),
          formatSize(asset.size),
          asset.chunks.join(', '),
          asset.emitted ? "[emitted]" : "",
          asset.isOverSizeLimit ? "[big]" : "",
          asset.chunkNames.join(", "),
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
        const str = asset.map((a, index) => {
          const length = a.length;
          let add = maxLength[index] - length;
          return `${a}${Buffer.alloc(add, ' ').toString()}`;
        }).join(' ');

        process.stderr.write(render('green', `${str}\n`));
      });
      process.stderr.write(render('green', 'Build Done!\n'));
    }
  }
}

try {
  if (isDev) {
    if (config.i18n && config.i18n.languages && config.i18n.defaultLanguage) {
      webpackOpt.module.rules.push({
        test: /lang.json$/,
        use: [{
          loader: require.resolve('lang-loader'),
          query: {
            language: config.i18n.defaultLanguage,
          },
        }, {
          loader: require.resolve('json-loader'),
        }]
      });

      webpackOpt.plugins.push(
        new InterpolateHtmlPlugin({
          language: config.i18n.defaultLanguage,
        })
      );
    }
    const compiler = webpack(webpackOpt);
    devServer(config, webpackOpt);

    const watching = compiler.watch({}, onComplete);

    process.stderr.write(render('green', 'Watching Started!\n'));
  } else {

    const doCompile = (opt) => {
      return new Promise((resolve, reject) => {
        const compiler = webpack(opt);
        compiler.run((err, stats) => {
          onComplete(err, stats);

          if (err || stats.hasErrors()) {
            reject();
          } else {
            resolve();
          }
        });
        const ProgressPlugin = require('webpack/lib/ProgressPlugin.js');
        compiler.apply(new ProgressPlugin({
          profile: true
        }));
      });
    }

    if (config.i18n && config.i18n.languages) {

      const allDone = [];

      config.i18n.languages.forEach(lang => {
        // Loop to set the language.
        let found = null;

        const clone = (obj) => {
          if (typeof obj === 'object' && !(obj instanceof RegExp)) {

            const res = (obj instanceof Array) ? [] : {};

            if (obj.__proto__ && !(obj instanceof Array)) {
              res.__proto__ = obj.__proto__;
            }
            Object.keys(obj).forEach(p => {
              res[p] = clone(obj[p]);
            });
            return res;
          }
          return obj;
        }
        const opt = clone(webpackOpt);
        // const opt = {};

        opt.module.rules.push({
          test: /lang.json$/,
          use: [{
            loader: require.resolve('lang-loader'),
            query: {
              language: lang,
            },
          }, {
            loader: require.resolve('json-loader'),
          }],
        });
        opt.output.filename = `./js/[name].[chunkhash:8].min.js`;
        opt.output.chunkFilename = `./js/[name].[chunkhash:8].chunk.min.js`;
        opt.output.path = `${opt.output.path}/${lang}`;
        opt.plugins.push(
          new InterpolateHtmlPlugin({
            language: lang,
          })
        );
        allDone.push(doCompile(opt));
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
