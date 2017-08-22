# remixure

remixure is to help to quickly build a webpack based React project.

# Install
Install with npm:
```
npm i --save-dev remixure
```
Install with yarn
```
yarn add remixure --dev
```


## Configurations:
```javascript
exports.less = {
  // Enable less

  // If enable CSS modules.
  enableCSSModule: true,
  // If use post css:
  enablePostCSS: true,
  // Exclude folder. node_modules is the default folder. Do not need to add it.
  exclude: [/iconfont/],
}

exports.enableAntD = true;  // If you are using antd.


```