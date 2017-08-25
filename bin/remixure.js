#!/usr/bin/env node

const webpack = require('webpack');
const autoprefixer = require('autoprefixer');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const chalk = require('chalk');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanPlugin = require('clean-webpack-plugin');

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
const entry = {};
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
    plugins: [
      require.resolve('babel-plugin-transform-runtime'),
      require.resolve('babel-plugin-syntax-dynamic-import'),
      require.resolve('babel-plugin-dynamic-import-node'),
    ],
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
  // include: /minion/, //includeModules.concat(sourceFolder),
  use: babelConfig,
};

// if (config.compiledNodeModules) {
//   let reg = config.compiledNodeModules.join('|');
//   reg = new RegExp(`(${reg})(.*)\.(js|jsx)`);

//   rules.push()
// }

if (config.enableAntD) {
  babelLoader.use.options.plugins.push([require.resolve('babel-plugin-import'), [{
    libraryName: "antd",
    style: true
  }]]);
}
const rules = [babelLoader];

if (config.less) {
  let exclude = [/node_modues/];
  if (config.less.exclude) {
    exclude = exclude.concat(config.less.exclude);
  }

  const use = [{
    loader: require.resolve('css-loader'),
    options: {
      importLoaders: 1,
      sourceMap: isDev,
      minimize: !isDev,
      modules: config.less.enableCSSModule,
      localIdentName: '[name]__[local]___[hash:base64:5]',
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
    options: {

    },
  });

  rules.push({
    test: /\.less$/,
    use: ExtractTextPlugin.extract({
      fallback: require.resolve('style-loader'),
      use,
    })
  });
}

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
  allChunks: true
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
    }
  },
  module: {
    rules,
    /*
    [
      {
      test: /\.js(.*)$/,
      exclude: /node_modules|moment/,
      use: {
        loader: require.resolve('babel-loader'),
        options: {
          presets: [require.resolve('babel-preset-latest'), require.resolve('babel-preset-react')],
          plugins: [require.resolve('babel-plugin-transform-runtime')],
        },
      },
    }, {
      loader: 'json-loader',
      test: /\.json$/
    }, {
      test: /\.less$/,
      loaders: ExtractTextPlugin.extract({
        use: [{
          loader: require.resolve('css-loader'),
          options: {
            sourceMap: true,
            minimize: false
          }
        }, {
          loader: require.resolve('postcss-loader'),
          options: {
            sourceMap: true,
            minimize: false,
            plugins: () => {
              return [autoprefixer];
            }
          }
        }, {
          loader: require.resolve('less-loader'),
          options: {
            sourceMap: true,
            minimize: false,
            sourceMap: true
          }
        }]
      })
    }, {
      test: /\.css$/,
      loader: ExtractTextPlugin.extract({
        "use": [{
          "loader": "css-loader",
          "options": {
            "sourceMap": true,
            "minimize": false
          }
        }, {
          "loader": "postcss-loader",
          "options": {
            "plugins": () => {
              return [autoprefixer];
            }
          }
        }]
      })
    }
  ],
    */
  },
  plugins,
  /*
  plugins: [
    new CleanPlugin(['static'], {
      root: __dirname
    }),
    new CopyPlugin([{
      from: 'node_modules/antd/dist/antd.min.css*',
      to: path.join(__dirname, 'static', '[name].[ext]'),
      context: __dirname,
    }, {
      from: 'src/statics/*',
      to: path.join(__dirname, 'static', '[name].[ext]'),
      context: __dirname,
    }]),
    new ExtractTextPlugin({
      filename: '[name].min.css',
      allChunks: true
    }),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
    new webpack.optimize.UglifyJsPlugin({
      sourceMap: true,
      compress: {
        warnings: false,
        drop_console: false,
      }
    }),
  ]
    */
};

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
const compiler = webpack(webpackOpt);

try {
  if (isDev) {
    devServer(config, webpackOpt);

    const watching = compiler.watch({}, onComplete);

    process.stderr.write(render('green', 'Watching Started!\n'));

  } else {
    compiler.run(onComplete);
  }
  const ProgressPlugin = require('webpack/lib/ProgressPlugin.js');
  compiler.apply(new ProgressPlugin({
    profile: true
  }));
} catch (e) {
  console.log(e);
}
