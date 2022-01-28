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

<sub>[**HOME**](https://github.com/voxjs/vox/wiki/home)</sub>  
<sub>[**INSTALLATION**](https://github.com/voxjs/vox/wiki/installation)</sub>  
<sub>[**MAIN CONCEPTS**](https://github.com/voxjs/vox/wiki/main-concepts)</sub>  
<sub>[**API REFERENCE**](https://github.com/voxjs/vox/wiki/api-reference)</sub>  
<sub>[**SHOPIFY**](https://github.com/voxjs/vox/wiki/shopify)</sub>  
<sub>[**RESOURCES**](https://github.com/voxjs/vox/wiki/resources)</sub>

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
  <button vox:onclick="(open = !open)">
    click
  </button>
  <div vox:if="(open)">
    hi! 👋
  </div>
</div>
```

&#8206;

[🔗](https://codepen.io/paulala/pen/ExveVxm) <code><**tabs**/></code>

``` html
<div vox="{ tab: 0 }">
  <button vox:onclick="(tab = 1)">
    tab 1
  </button>
  <button vox:onclick="(tab = 2)">
    tab 2
  </button>
  <button vox:onclick="(tab = 3)">
    tab 3
  </button>
  <div vox:hidden="(tab !== 1)">
    cupcake 🧁
  </div>
  <div vox:hidden="(tab !== 2)">
    cookie 🍪
  </div>
  <div vox:hidden="(tab !== 3)">
    chocolate 🍫
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
    todos.push(els.input.value || '…');
    els.input.value = '';
  }">
    <input placeholder="…" vox:el="('input')"/>
    <button>add to-do</button>
  </form>
</div>
```

<!--
&#8206;

**CONTRIBUTORS**

&#8206;

**SPONSORS**
-->

&#8206;

<sub>**COPYRIGHT &#169; 2021 [PAULA GRIGUȚĂ](https://paula.dev) AND [CONTRIBUTORS](https://github.com/voxjs/vox/blob/main/package.json)**</sub>
