'use strict';


const pluginConfig = require('plugin');


Object.keys(pluginConfig).forEach(plugin => {
  try {
    const p = require(plugin);
    console.log(p);
  } catch (e) {
    console.log(e);
  }
});


module.exports = pluginConfig;
