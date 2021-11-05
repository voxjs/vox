# vox.js
<sup>**⚡️ INSTANT INTERACTIVITY FOR THE WEB 💫**</sup>

Vox is a tiny (&#8776;7KB) JavaScript library that allows you to enhance your HTML with declarative two-way data bindings, using simple, native-like attributes (directives).

[![](https://badgen.net/npm/v/@voxjs/vox)](https://npmjs.com/package/@voxjs/vox)  
[![](https://badgen.net/bundlephobia/minzip/@voxjs/vox)](https://bundlephobia.com/package/@voxjs/vox)

&#8206;

``` html
<script src="vox.min.js"></script>

<div vox="{ world: [ '🌏', '🌍', '🌎' ] }">
  hello, <span vox:text="world.join(' ')"></span>!
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

&#8206;

**DOCUMENTATION**

<sub>[**HOME**](https://github.com/voxjs/vox/wiki/01.-HOME)</sub>  
<sub>[**INSTALLATION**](https://github.com/voxjs/vox/wiki/02.-INSTALLATION)</sub>  
<sub>[**MAIN CONCEPTS**](https://github.com/voxjs/vox/wiki/03.-MAIN-CONCEPTS)</sub>  
<sub>[**API REFERENCE**](https://github.com/voxjs/vox/wiki/04.-API-REFERENCE)</sub>  
<sub>[**SHOPIFY**](https://github.com/voxjs/vox/wiki/05.-SHOPIFY)</sub>  
<sub>[**RESOURCES**](https://github.com/voxjs/vox/wiki/06.-RESOURCES)</sub>

&#8206;

<sup>*demo or it didn't happen.*</sup>

[🔗](https://codepen.io/paulala/pen/LYjdYdG) <code><**counter**/></code>

``` html
<div vox="{ count: 0 }">
  <button vox:onclick="(count--)">
    &minus;
  </button>
  <span vox:text="(count)"></span>
  <button vox:onclick="(count++)">
    &plus;
  </button>
</div>
```

&#8206;

[🔗](https://codepen.io/paulala/pen/mdMxyEx) <code><**dialog**/></code>

``` html
<div vox="{ open: false }">
  <button vox:onclick="(open=!open)">
    click
  </button>
  <div vox:if="(open)">
    hi! 👋
  </div>
</div>
```

&#8206;

[🔗](https://codepen.io/paulala/pen/abyYzJB) <code><**to-dos**/></code>

``` html
<div vox="{ todos: [ '☕️', '💻', '💤' ] }">
  <ol vox:if="(todos.length > 0)">
    <li vox:for="(todo in todos)">
      <span vox:text="(todo)"></span>
      <button vox:onclick="{
        todos.splice(todos.indexOf(todo), 1);
      }">
        &times;
      </button>
    </li>
  </ol>
  <form vox:onsubmit.prevent="{
    todos.push(els.input.value);
    els.input.value = '';
  }">
    <input vox:is="('input')"/>
  </form>
</div>
```

<!--
&#8206;

**CONTRIBUTORS**

&#8206;

**SPONSORS**
-->
