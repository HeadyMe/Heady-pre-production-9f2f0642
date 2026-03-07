const { createApp } = require('./App');

function mount(el, props) {
  return createApp(el, props);
}

if (typeof module !== 'undefined') module.exports = { mount };
