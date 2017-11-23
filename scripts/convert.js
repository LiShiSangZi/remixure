'use strict';

const {
  transform
} = require('babel-core');
const glob = require('glob');
const fs = require('fs-extra');
const path = require('path');
const root = path.join(__dirname, '..', 'src');
const files = glob.sync('{**/*.js,**/*.jsx}', {
  cwd: root,
});
const target = path.join(__dirname, '..', 'bin');

try {
  fs.removeSync(target);
} catch (e) {
  console.log('The folder is not there. Ignore.');
}
fs.mkdirSync(target);

files.forEach(f => {
  const p = path.join(root, f);
  const content = fs.readFileSync(p);
  const r = transform(content, {
    presets: [
      [
        require.resolve('babel-preset-env'),
        {
          targets: {
            node: "4.3.0",
          }
        }
      ],
    ],
    plugins: [
      require.resolve('babel-plugin-transform-runtime'),
      require.resolve('babel-plugin-transform-object-rest-spread'),
    ],
  });
  const dest = path.join(target, f);
  try {
    fs.ensureDirSync(target);
    fs.removeSync(dest);
  } catch (e) {

  }
  fs.writeFileSync(dest, r.code, {
    mode: 33261, //fs.constants.S_IRWXU,
  });
});
