import { api } from './api.js';
import { closest } from './app.js';
import { context } from './context.js';
import { evaluator } from './evaluator.js';
import {
  raw,
  reaction,
  reactive,
  readonly
} from './reactivity.js';
import {
  bindings,
  camelize,
  classify,
  controls,
  define,
  extend,
  isArray,
  isObject,
  isString,
  specials,
  styleify,
  voxRE
} from './utils.js';

const vox = ({ el } = {}) => {
  const _ = {};
  if (el !== void(0)) {
    if (isString(el)) {
      el = document.querySelector(el);
    }
    if (el) {
      _.init = () => {
        if (!el.__vox) {
          vox_init(el);
        }
      };
      _.exit = () => {
        if (el.__vox) {
          vox_exit(el);
        }
      };
    }
  } else {
    const els = (
      document.querySelectorAll(
        '[vox]:not([vox] [vox])'
      )
    );
    _.init = () => {
      for (const el of els) {
        if (!el.__vox) {
          vox_init(el);
        }
      }
    };
    _.exit = () => {
      for (const el of els) {
        if (el.__vox) {
          vox_exit(el);
        }
      }
    };
  }
  return (_);
};

const vox_init = (el) => {
  if (!el.__vox) {
    el.__vox = context([
      readonly({ el }),
      ...closest(el)
        .__vox__.slice(1)
    ]);
  }
  if (!el.__vox_cleanup) {
    el.__vox_cleanup = [];
  }
  if (!el.__vox_init) {
    el.__vox_init = [];
  }
  if (!el.__vox_exit) {
    el.__vox_exit = [];
  }
  const attrs = (
    el.getAttributeNames()
      .filter((attr) => voxRE.test(attr))
      .sort((attrA, attrB) => {
        const a = (
          attrA
            .split('.')[0]
            .split(':')
        );
        const b = (
          attrB
            .split('.')[0]
            .split(':')
        );
        let i = specials.indexOf(
          (a[1] === void(0))
            ? a[0]
            : a[1]
        );
        let j = specials.indexOf(
          (b[1] === void(0))
            ? b[0]
            : b[1]
        );
        if (i === -1) {
          i = 6; // 💩 i = specials.indexOf('*');
        }
        if (j === -1) {
          j = 6; // 💩 j = specials.indexOf('*');
        }
        return (i - j);
      })
  );
  for (const attr of attrs) {
    const result = attr.match(voxRE);
    const name = result[1] || 'vox';
    const key = (result[2] || '').slice(1);
    const flags = (
      (result[3] || '')
        .split('.')
        .filter(Boolean)
    );
    const expression = (
      el.getAttribute(attr)
        .trim()
    );
    switch (name) {
      case 'skip': {
        if (!expression || (
          evaluator(expression)
            .call(el.__vox)
        )) {
          vox_exit(el);
          return;
        }
        break;
      }
      case 'vox': {
        if (!(
          el.__vox_for ||
          el.__vox_if
        )) {
          el.__vox
            .__vox__.splice(
              1, 0,
              reactive(
                evaluator(`(api)=>{with(api)return(${expression})}`)
                  .call(el.__vox)(api)
              )
            );
          if (
            el.__vox
              .__vox__[1].init
          ) {
            el.__vox_init.push(
              el.__vox.init
                .bind(el.__vox)
            );
            el.__vox.init();
          }
          if (
            el.__vox
              .__vox__[1].exit
          ) {
            el.__vox_exit.push(
              el.__vox.exit
                .bind(el.__vox)
            );
          }
        }
        break;
      }
      case 'for': {
        if (!el.__vox_for) {
          vox_for(el, expression);
          return;
        }
        break;
      }
      case 'if': {
        if (!el.__vox_if) {
          vox_if(el, expression);
          return;
        }
        break;
      }
      case 'el': {
        vox_el(el, expression);
        break;
      }
      case 'init': {
        const init = (
          evaluator(`()=>{${expression}}`)
            .call(el.__vox)
        );
        el.__vox_init.push(init);
        init();
        break;
      }
      case 'aria':
      case 'attr': {
        const aria = name === 'aria';
        vox_attr(el, expression, key, flags, aria);
        break;
      }
      case 'class': {
        vox_class(el, expression, key, flags);
        break;
      }
      case 'event': {
        vox_event(el, expression, key, flags);
        break;
      }
      case 'focus': {
        vox_focus(el, expression);
        break;
      }
      case 'run': {
        vox_run(el, expression);
        break;
      }
      case 'style': {
        vox_style(el, expression, key, flags);
        break;
      }
      case 'exit': {
        el.__vox_exit.push(
          evaluator(`()=>{${expression}}`)
            .call(el.__vox)
        );
        break;
      }
      default: {
        if (name.slice(0, 2) === 'on') {
          const key = name.slice(2);
          vox_event(el, expression, key, flags);
        } else {
          const key = bindings[name] || name;
          if (key && (key in el)) {
            vox_bind(el, expression, key);
          }
        }
      }
    }
  }
  (el.__vox_content || (
    el.__vox_content = (
      Array.from(el.children)
    )
  ))
    .forEach(vox_init);
};

const vox_for = (el, expression) => {
  const vars = expression.match(
    /\w+(?=.*\b(in|of)\b)/g
  );
  for (let i = 0; i < vars.length; i++) {
    expression = expression.replace(
      new RegExp(`\\b${vars[i]}\\b`),
      (i)
    );
  }
  expression = expression.replace(
    /\b(in|of)\b/,
    ','
  );
  const content = [];
  const self = document.createTextNode('');
  const { run, cleanup } = reaction(
    () => {
      let value = (
        evaluator(expression)
          .call(el.__vox)
      );
      if (isArray(value)) {
        value = Array.from(
          Array.prototype.entries
            .call(value)
        );
      } else if (isObject(value)) {
        value = Object.entries(value);
      } else if (isString(value)) {
        value = Array.from(
          value,
          (char, i) => [ i, char ]
        );
      } else if (value > 0) {
        value = Array.from(
          Array(value),
          (_, i) => [ i, i + 1 ]
        );
      } else {
        value = [];
      }
      return value;
    },
    (value) => {
      let i = 0;
      while ( content[i] &&  value[i] ) {
        const variables = (
          content[i]
            .__vox
            .__vox__[1]
        );
        if (vars[0]) {
          define(variables, {
            [vars[0]]: {
              writable: true
            }
          });
          extend(variables, {
            [vars[0]]: value[i][1]
          });
          define(variables, {
            [vars[0]]: {
              writable: false
            }
          });
        }
        if (vars[1]) {
          define(variables, {
            [vars[1]]: {
              writable: true
            }
          });
          extend(variables, {
            [vars[1]]: value[i][0]
          });
          define(variables, {
            [vars[1]]: {
              writable: false
            }
          });
        }
        if (vars[2]) {
          define(variables, {
            [vars[2]]: {
              writable: true
            }
          });
          extend(variables, {
            [vars[2]]: i
          });
          define(variables, {
            [vars[2]]: {
              writable: false
            }
          });
        }
        (i++);
      }
      while (!content[i] &&  value[i] ) {
        const element = el.cloneNode(true);
        const variables = {};
        if (vars[0]) {
          define(variables, {
            [vars[0]]: {
              value: value[i][1],
              configurable: true,
              enumerable: true
            }
          });
        }
        if (vars[1]) {
          define(variables, {
            [vars[1]]: {
              value: value[i][0],
              configurable: true,
              enumerable: true
            }
          });
        }
        if (vars[2]) {
          define(variables, {
            [vars[2]]: {
              value: i,
              configurable: true,
              enumerable: true
            }
          });
        }
        self.parentNode.insertBefore(element, self);
        content[i] = element;
        element.__vox = context([
          readonly({
            el: element
          }),
          reactive(variables),
          ...(
            el.__vox
              .__vox__.slice(1)
          )
        ]);
        element.__vox_for = el;
        vox_init(element);
        (i++);
      }
      while ( content[i] && !value[i] ) {
        const element = content[i];
        vox_exit(element);
        content[i] = null;
        element.parentNode.removeChild(element);
        (i++);
      }
      content.length = value.length;
    }
  );
  el.__vox_for = el;
  el.__vox_content = content;
  el.__vox_cleanup.push(() => {
    cleanup();
    content.forEach((element) => {
      element.parentNode.removeChild(element);
    });
    self.parentNode.replaceChild(el, self);
  });
  el.parentNode.replaceChild(self, el);
  run();
};

const vox_if = (el, expression) => {
  let condition = false;
  const content = [];
  const element = el.cloneNode(true);
  const self = document.createTextNode('');
  const { run, cleanup } = reaction(
    () => (
      evaluator(`!!(${expression})`)
        .call(el.__vox)
    ),
    (value) => {
      if (condition !== value) {
        condition = value;
        if (condition) {
          self.parentNode.insertBefore(element, self);
          content.push(element);
          element.__vox = context([
            readonly({
              el: element
            }),
            ...(
              el.__vox
                .__vox__.slice(1)
            )
          ]);
          if (el.__vox_for) {
            element.__vox_for = el.__vox_for;
          }
          element.__vox_if = el;
          vox_init(element);
        } else {
          vox_exit(element);
          content.pop();
          element.parentNode.removeChild(element);
        }
      }
    }
  );
  el.__vox_if = el;
  el.__vox_content = content;
  el.__vox_cleanup.push(() => {
    cleanup();
    if (condition) {
      element.parentNode.removeChild(element);
    }
    self.parentNode.replaceChild(el, self);
  });
  el.parentNode.replaceChild(self, el);
  run();
};

const vox_el = (el, expression) => {
  let cleanup;
  expression = expression.replace(/\W/g, '');
  const arr = (
    el.__vox
      .__vox__
  );
  const els = raw(
    arr[arr.length - 1].els
  );
  if (el.__vox_for) {
    let clones = els[expression];
    if (!clones) {
      clones = (
        els[expression] = []
      );
    }
    clones.push(el);
    cleanup = () => {
      clones.splice(
        clones.indexOf(el),
        1
      );
      if (clones.length === 0) {
        delete els[expression];
      }
    };
  } else {
    els[expression] = el;
    cleanup = () => {
      delete els[expression];
    };
  }
  el.__vox_cleanup.push(cleanup);
};

const vox_attr = (el, expression, key, flags, aria) => {
  if (
    key &&
    flags.includes('camel')
  ) {
    key = camelize(key);
  }
  const { run, cleanup } = reaction(
    () => (
      evaluator(expression)
        .call(el.__vox)
    ),
    (value) => {
      const obj = (
        (key)
          ? { [key]: value }
          : value
      );
      for (let key in obj) {
        const value = obj[key];
        if (aria) {
          key = `aria-${key}`;
        }
        if (value != null) {
          el.setAttribute(key, value);
        } else {
          el.removeAttribute(key);
        }
      }
    }
  );
  el.__vox_cleanup.push(cleanup);
  run();
};

const vox_bind = (el, expression, key) => {
  const { run, cleanup } = reaction(
    () => (
      evaluator(expression)
        .call(el.__vox)
    ),
    (value) => {
      el[key] = value;
    }
  );
  if (
    key === 'innerHTML' ||
    key === 'textContent'
  ) {
    el.__vox_content = [];
  }
  el.__vox_cleanup.push(cleanup);
  run();
};

const vox_class = (el, expression, key, flags) => {
  if (
    key &&
    flags.includes('camel')
  ) {
    key = camelize(key);
  }
  let classes = [];
  const { run, cleanup } = reaction(
    () => (
      evaluator(expression)
        .call(el.__vox)
    ),
    (value) => {
      if (key) {
        el.classList.toggle(key, value);
      } else {
        const classList = (
          classify(value)
            .split(/\s+/)
            .filter(Boolean)
        );
        el.classList.remove(...classes);
        el.classList.add(...classList);
        classes = classList;
      }
    }
  );
  el.__vox_cleanup.push(() => {
    cleanup();
    if (!key) {
      el.classList.remove(...classes);
    }
  });
  run();
};

const vox_event = (el, expression, key, flags) => {
  let cleanup;
  if (key) {
    let self = el;
    const options = {};
    for (const flag of flags.reverse()) {
      switch (flag) {
        case 'camel': {
          key = camelize(key);
          break;
        }
        case 'win':
        case 'window': {
          self = window;
          break;
        }
        case 'doc':
        case 'document': {
          if (self === el) {
            self = document;
          }
          break;
        }
        case 'out':
        case 'outside': {
          if (self === el) {
            self = document;
          }
          expression = (
            `if(!el.contains(event.target)){${expression}}`
          );
          break;
        }
        case 'self': {
          expression = (
            `if(event.target===el){${expression}}`
          );
          break;
        }
        case 'prevent': {
          expression = (
            `event.preventDefault();${expression}`
          );
          break;
        }
        case 'stop': {
          expression = (
            `event.stopPropagation();${expression}`
          );
          break;
        }
        case 'back':
        case 'del':
        case 'delete':
        case 'down':
        case 'enter':
        case 'esc':
        case 'escape':
        case 'forward':
        case 'left':
        case 'mid':
        case 'middle':
        case 'right':
        case 'space':
        case 'tab':
        case 'up': {
          const control = controls[flag];
          const conditions = [];
          if (control.button >= 0) {
            conditions.push(
              `event.button===${control.button}`
            );
          }
          if (control.keys) {
            conditions.push(
              ...control.keys.map(
                (key) => `event.key==="${key}"`
              )
            );
          }
          expression = (
            `if(${conditions.join('||')}){${expression}}`
          );
          break;
        }
        case 'alt':
        case 'ctrl':
        case 'meta':
        case 'shift': {
          expression = (
            `if(event.${flag}Key){${expression}}`
          );
          break;
        }
        case 'repeat': {
          expression = (
            `if(event.repeat){${expression}}`
          );
          break;
        }
        case 'capture': {
          options.capture = true;
          break;
        }
        case 'once': {
          options.once = true;
          break;
        }
        case 'passive': {
          options.passive = true;
          break;
        }
      }
    }
    const handler = (
      evaluator(`(event)=>{${expression}}`)
        .call(el.__vox)
    );
    cleanup = () => {
      self.removeEventListener(
        key,
        handler,
        options
      );
    };
    self.addEventListener(
      key,
      handler,
      options
    );
  } else {
    const obj = (
      evaluator(expression)
        .call(el.__vox)
    );
    cleanup = () => {
      for (const key in obj) {
        el.removeEventListener(
          key,
          obj[key]
        );
      }
    };
    for (const key in obj) {
      el.addEventListener(
        key,
        obj[key]
      );
    }
  }
  el.__vox_cleanup.push(cleanup);
};

const vox_focus = (el, expression) => {
  let condition = false;
  let element;
  const { run, cleanup } = reaction(
    () => (
      evaluator(`!!(${expression})`)
        .call(el.__vox)
    ),
    (value) => {
      if (condition !== value) {
        condition = value;
        if (condition) {
          element = document.activeElement;
          el.focus();
        } else if (element) {
          element.focus();
        }
      }
    }
  );
  el.__vox_cleanup.push(cleanup);
  run();
};

const vox_run = (el, expression) => {
  const { run, cleanup } = reaction(
    evaluator(`()=>{${expression}}`)
      .call(el.__vox)
  );
  el.__vox_cleanup.push(cleanup);
  run();
};

const vox_style = (el, expression, key, flags) => {
  if (
    key &&
    flags.includes('camel')
  ) {
    key = camelize(key);
  }
  let keys = [];
  const { run, cleanup } = reaction(
    () => (
      evaluator(expression)
        .call(el.__vox)
    ),
    (value) => {
      if (key) {
        el.style[key] = value;
      } else {
        const style = (
          styleify(value)
            .split(/\s*;+\s*/)
            .reduce(
              (style, value) => {
                if (value.includes(':')) {
                  const css = value.split(/\s*:\s*/);
                  if (css[0]) {
                    style[css[0]] = css[1];
                  }
                }
                return style;
              }, {}
            )
        );
        for (const key of keys) {
          el.style[key] = '';
        }
        extend(el.style, style);
        keys = Object.keys(style);
      }
    }
  );
  el.__vox_cleanup.push(() => {
    cleanup();
    if (!key) {
      for (const key of keys) {
        el.style[key] = '';
      }
    }
  });
  run();
};

const vox_exit = (el) => {
  if (el.__vox_content) {
    el.__vox_content.forEach(vox_exit);
    delete el.__vox_content;
  }
  if (el.__vox_cleanup) {
    el.__vox_cleanup.forEach(
      (cleanup) => cleanup()
    );
    delete el.__vox_cleanup;
  }
  if (el.__vox) {
    delete el.__vox;
  }
  if (el.__vox_for) {
    delete el.__vox_for;
  }
  if (el.__vox_if) {
    delete el.__vox_if;
  }
  if (el.__vox_init) {
    delete el.__vox_init;
  }
  if (el.__vox_exit) {
    el.__vox_exit.forEach(
      (exit) => exit()
    );
    delete el.__vox_exit;
  }
};

export { vox };
