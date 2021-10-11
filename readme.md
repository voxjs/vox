# vox.js
*instant interactivity for the web* ✨

Vox is a tiny (<10KB) JavaScript library that allows you to enhance your HTML with declarative two-way data bindings, using simple, native-like attributes.

[![](https://badgen.net/npm/v/@voxjs/vox)](https://npmjs.com/package/@voxjs/vox)
[![](https://badgen.net/bundlephobia/minzip/@voxjs/vox)](https://bundlephobia.com/package/@voxjs/vox)

**FEATURES**
* data binding + event handling;
* declarative code;
* reactive (powered by [`@vue/reactivity`](https://github.com/vuejs/vue-next/tree/master/packages/reactivity));
* easy to learn;
* small *and* mighty!

## 🚀 Setup
For more detailed instructions, please read the [docs](https://github.com/voxjs/vox/wiki).

``` html
<script src="vox.min.js"></script>

<div vox="{ world: [ '🌏', '🌍', '🌎' ] }">
  Hello, <span vox:text="world.join(' ')"></span>!
  <br/>
  <button vox:onclick.once="world.push('👽')">
    click...
  </button>
</div>

<script>
  const app = vox();
  app.init();
  // ...that's all, folks!
  app.exit();
</script>
```

## 📚 Documentation
Documentation is available @ [wiki](https://github.com/voxjs/vox/wiki).

## 🌈 Contributing
All contributions (feedback included) are welcome! 🙌
