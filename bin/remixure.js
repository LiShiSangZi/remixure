#!/usr/bin/env node

const webpack = require('webpack');
const autoprefixer = require('autoprefixer');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const chalk = require('chalk');

const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');

const path = require('path');
const fs = require('fs');

const baseFolder = path.resolve('.');
const configPath = path.join(baseFolder, 'config');

let config = {};

try {
  const c = require(path.join(configPath, 'config.default.js'));
  config = c;
} catch (e) {
  throw new Error(chalk.red('The config file is not found!'));
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

try {
  if (!env) {
    env = fs.readFileSync(path.join(configPath, 'env'));
    env = env.toString();
  }
  const addFileName = `config.${env}.js`;
  const c = require(path.join(configPath, addFileName));
  config = Object.assign(config, addFileName);
} catch (e) {

}

const sourceFolder = path.join(baseFolder, (config.srcFolder || 'src'));

/** webpack entry list. */
const entry = {};
if (config.entry && config.entry.entries) {
  entry = config.entry.entries;
} else {
  fs.readdirSync(sourceFolder).filter(file => {
    return fs.statSync(path.join(sourceFolder, file)).isFile && /\.js(x*)$/.test(file) && config.entry.exclude.indexOf(file) < 0;
  }).forEach(file => {
    entry[file.replace(/\.js(x*)$/, '')] = path.join(sourceFolder, file);
  });
}

/**
 * Build your webpack
 */
const webpackOpt = {
  // In production, we only want to load the polyfills and the app code.
  bail: true,
  entry,
  output: {
    // The build folder.
    path: path.join(baseFolder, (config.targetFolder || 'dist')),
    // Generated JS file names (with nested folders).
    // There will be one main bundle, and one file per asynchronous chunk.
    // We don't currently advertise code splitting but Webpack supports it.
    filename: './js/[name].[chunkhash:8].min.js',
    chunkFilename: './js/[name].[chunkhash:8].chunk.min.js',
    // We inferred the "public path" (such as / or /my-project) from homepage.
    publicPath: '/',
  },
  resolve: {
    // This allows you to set a fallback for where Webpack should look for modules.
    // We placed these paths second because we want `node_modules` to "win"
    // if there are any conflicts. This matches Node resolution mechanism.
    // https://github.com/facebookincubator/create-react-app/issues/253
    modules: [sourceFolder, path.join(baseFolder, 'node_modules'), path.join(__dirname, '..', 'node_modues')].concat(
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
    rules: [{
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
    }],
  },
  plugins: [
    /*
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
    */
    new ExtractTextPlugin({
      filename: '[name].min.css',
      allChunks: true
    }),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
    /*
    new webpack.optimize.UglifyJsPlugin({
      sourceMap: true,
      compress: {
        warnings: false,
        drop_console: false,
      }
    }),
    */
  ]
};

const compiler = webpack(webpackOpt);
compiler.run((err, stats) => {
  if (err) {
    console.log(err);
  } else {
    const s = stats.toJson('verbose');
    s.errors.forEach(e => console.log(chalk.red(e)));
    s.warnings.forEach(e => console.log(chalk.yellow(e)));
    if (stats.hasErrors()) {
      // s.errors.forEach(e => console.log(chalk.red(e)));
    } else {
      // s.warnings.forEach(e => console.log(chalk.yellow(e)));
      console.log(s.entrypoints);
    }
  }
});
