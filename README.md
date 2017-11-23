# remixure

remixure is to help to quickly build a webpack based React project. You don't have to familay with the webpack, babel and so on.
remixure will help to build your React/ES6/LESS code. All you have to do is to install the remixure and run the build.

# Install
Install with npm:
```shell
npm i --save-dev remixure
```
Install with yarn
```shell
yarn add remixure --dev
```

# How to use
1. In your project package.json, add the content:
```json
"scripts": {
  "build": "remixure build --env=prod",
  "dev": "remixure build --env=dev"
}
```
2. Create the configuration file in your config folder.
- config.default.js: The default configuration file can save all the basic configurations.
- env: The env speicific file. You can also set the env in the CLI. The CLI --env=prod value will overwrite the env file's configuration.
- config.${env}.js: The configuration file for the target env. It will overwrite the config.default.js.

3. Do the build:
```shell
yarn run dev
# OR
yarn run production
```



## Configurations:
```javascript

exports.publicPath = '/'; // Optional: The public path for the build. Default is /.

exports.less = {
  // Enable less

  // If enable CSS modules.
  enableCSSModule: true,
  // If use post css:
  enablePostCSS: true,
  // Exclude folder. node_modules is the default folder. Do not need to add it.
  exclude: [/iconfont/],
  options: {
    modifyVars: "green",  // Customize options for less.
  }
}
exports.entry = {
  // This is the entry file configuration. 
  // By default entry files will be all jsx/js file under src's root folder. 
  // If you want to exclude some file, you need to do as follows: 
  
}

exports.antd = { // If you are using antd.
  theme: 'YOUR THEME HERE', // If you are using ant theme.
};

exports.ignoreUglify = true; // You can ignore the uglify process by setting this to true.

exports.useMoment = true; // If you are using moment.js.

exports.chunks = ['vendor', 'components']; // The chunk key you want to do the chunk.

exports.htmlPath = 'public/index.html'; // If you want to pack index.html with the <script> inject. You need the speicific your index template path.

exports.cleanBeforeBuild = true; // If you want to clean the build folder before job start.

exports.compiledNodeModules = ['YourModuleCode']; // If you want to build some node_module folders using babel loader or less loader. Put it here.

exports.ignoreCSSModule = ['YourCSSModule']; // If you want want any projects like antd ignore CSS module. Put it here.

exports.i18n = {
  "languages": ["en", "zh-CN"],
  "defaultLanguage": "zh-CN",  // This is only used in dev mode.
};  // If you want to use multi-language. We can use the lang-loader for you.

exports.addtionalPlugins = [...]; // Your plugin in here.

```

If you want to use the dev mode. There are some addional configurations under config/config.dev.js:
```javascript
// This can be put in config.dev.js so that the production will not excuted.
exports.devServer = {
  "HTTPS": "https", // Optional: Default value is http.
  "HOST": "0.0.0.0", // Optional: Default value is 0.0.0.0.
  "PORT": "8888", // Optional: Default value is 8888.
}; // If you want to enable the devServer.

exports.i18n.defaultLanguage = 'zh-CN'; // For dev mode, we can only compile one language for one time. So we need to speicific the default language.

exports.enableSourceMap = true; // Make the source map avaiable even dev is false.

exports.ignoreNameHash = true; // This will not hash your output file name even in production mode.

exports.browsers: = [
  '>1%',
  'last 4 versions',
  'Firefox ESR',
  'not ie < 9'
]; // You can sepecific target browsers you need.
```

## Read language configuration from JS code
In your HTML template, put the code like this:
```html
<script>
  var language = '%language%';
</script>
```
Then you can use this in your code now.