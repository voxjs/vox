import { api } from './api.js';
import { app } from './app.js';
import { context } from './context.js';
import { evaluator } from './evaluator.js';
import {
  raw,
  reaction,
  reactive,
  readonly,
  shallowReadonly
} from './reactivity.js';
import {
  camelize,
  define,
  directives,
  extend,
  hyphenate,
  isArray,
  isObject,
  isString,
  keys,
  normalize,
  reducer,
  voxRE
} from './utils.js';

const vox = (q = '[vox]') => {
  const _ = {};
  if (isString(q)) {
    const els = (
      document.querySelectorAll(
        `${q}:not(${q} ${q})`
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
  } else {
    let { el } = (q || {});
    if (isString(el)) {
      el = document.querySelector(el);
    }
    _.init = () => {
      if (el && !el.__vox) {
        vox_init(el);
      }
    };
    _.exit = () => {
      if (el && el.__vox) {
        vox_exit(el);
      }
    };
  }
  return (_);
};

const vox_init = (el) => {
  if (!el.__vox) {
    el.__vox = context([
      readonly({ el }),
      ...(el.parentNode.__vox || app())
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
  const dirs = (
    el.getAttributeNames()
      .filter((dir) => voxRE.test(dir))
      .sort((dirA, dirB) => {
        const a = (
          dirA
            .split('.')[0]
            .split(':')
        );
        const b = (
          dirB
            .split('.')[0]
            .split(':')
        );
        let i = directives.indexOf(
          (a[1] === void(0))
            ? a[0]
            : a[1]
        );
        let j = directives.indexOf(
          (b[1] === void(0))
            ? b[0]
            : b[1]
        );
        if (i === -1) {
          i = 6;
        }
        if (j === -1) {
          j = 6;
        }
        return (i - j);
      })
  );
  for (const dir of dirs) {
    const result = dir.match(voxRE);
    const name = result[1] || 'vox';
    const key = (result[2] || '').slice(1);
    const flags = (
      (result[3] || '')
        .split('.')
        .reduce(reducer, {})
    );
    const expression = (
      el.getAttribute(dir)
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
          const {
            app,
            vox
          } = raw(
            el.__vox
              .__vox__.pop()
          );
          el.__vox
            .__vox__.splice(
              1, 0,
              reactive(
                evaluator(`(api)=>{with(api)return(${expression})}`)
                  .call(el.__vox)(api)
              )
            );
          el.__vox
            .__vox__.push(
              shallowReadonly({
                app,
                els: readonly({}),
                vox: (index = 0) => (
                  (index === 0)
                    ? el.__vox
                    : (index > 0)
                      ? vox(index - 1)
                      : void(0)
                )
              })
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
      case 'attr':
      case 'aria':
      case 'data': {
        let alias;
        if (name !== 'attr') {
          alias = name;
        }
        vox_attr(el, expression, key, flags, alias);
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
          const key = keys[name] || name;
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
  for (const i in vars) {
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
  const node = document.createTextNode('');
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
      } else if (
        value > 0 &&
        value < Math.pow(2, 32)
      ) {
        value = Array.from(
          new Array(value),
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
        node.parentNode.insertBefore(element, node);
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
    node.parentNode.replaceChild(el, node);
  });
  el.parentNode.replaceChild(node, el);
  run();
};

const vox_if = (el, expression) => {
  let condition = false;
  const content = [];
  const element = el.cloneNode(true);
  const node = document.createTextNode('');
  const { run, cleanup } = reaction(
    () => (
      evaluator(`!!(${expression})`)
        .call(el.__vox)
    ),
    (value) => {
      if (condition !== value) {
        condition = value;
        if (condition) {
          node.parentNode.insertBefore(element, node);
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
    node.parentNode.replaceChild(el, node);
  });
  el.parentNode.replaceChild(node, el);
  run();
};

const vox_el = (el, expression) => {
  const name = (
    evaluator(expression)
      .call(el.__vox)
  );
  const { els } = raw(
    el.__vox
      .__vox__[
        el.__vox
          .__vox__.length - 1
      ]
  );
  define(els, {
    [name]: {
      value: el,
      configurable: true,
      enumerable: true
    }
  });
  el.__vox_cleanup.push(() => {
    delete els[name];
  });
};

const vox_attr = (el, expression, key, flags, alias) => {
  if (key && flags.camel) {
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
        if (alias) {
          key = `${alias}-${key}`;
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
  if (key && flags.camel) {
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
        el.classList.remove(...classes);
        el.classList.add(...(
          classes = normalize(value)
        ));
      }
    }
  );
  el.__vox_cleanup.push(cleanup);
  run();
};

const vox_event = (el, expression, key, flags) => {
  let cleanup;
  if (key) {
    let target = el;
    const fn = new Array(2);
    const options = {};
    for (const flag in flags) {
      switch (flag) {
        case 'camel': {
          key = camelize(key);
          break;
        }
        case 'win':
        case 'window': {
          target = window;
          break;
        }
        case 'doc':
        case 'document': {
          target = document;
          break;
        }
        case 'out':
        case 'outside': {
          if (target === el) {
            target = document;
          }
          fn[1] = (event) => {
            if (!el.contains(event.target)) {
              fn[2](event);
            }
          };
          break;
        }
        case 'self': {
          const i = fn.push((event) => {
            if (event.target === el) {
              fn[i](event);
            }
          });
          break;
        }
        case 'prevent': {
          const i = fn.push((event) => {
            event.preventDefault();
            fn[i](event);
          });
          break;
        }
        case 'stop': {
          const i = fn.push((event) => {
            event.stopPropagation();
            fn[i](event);
          });
          break;
        }
        case 'immediate': {
          const i = fn.push((event) => {
            event.stopImmediatePropagation();
            fn[i](event);
          });
          break;
        }
        case 'left': {
          const i = fn.push((event) => {
            if (
              event.button === 0 ||
              event.key === 'ArrowLeft' ||
              event.key === 'Left'
            ) {
              fn[i](event);
            }
          });
          break;
        }
        case 'mid':
        case 'middle': {
          const i = fn.push((event) => {
            if (event.button === 1) {
              fn[i](event);
            }
          });
          break;
        }
        case 'right': {
          const i = fn.push((event) => {
            if (
              event.button === 2 ||
              event.key === 'ArrowRight' ||
              event.key === 'Right'
            ) {
              fn[i](event);
            }
          });
          break;
        }
        case 'up': {
          const i = fn.push((event) => {
            if (
              event.key === 'ArrowUp' ||
              event.key === 'Up'
            ) {
              fn[i](event);
            }
          });
          break;
        }
        case 'down': {
          const i = fn.push((event) => {
            if (
              event.key === 'ArrowDown' ||
              event.key === 'Down'
            ) {
              fn[i](event);
            }
          });
          break;
        }
        case 'del':
        case 'delete': {
          const i = fn.push((event) => {
            if (
              event.key === 'Backspace' ||
              event.key === 'Delete' ||
              event.key === 'Del'
            ) {
              fn[i](event);
            }
          });
          break;
        }
        case 'enter': {
          const i = fn.push((event) => {
            if (event.key === 'Enter') {
              fn[i](event);
            }
          });
          break;
        }
        case 'esc':
        case 'escape': {
          const i = fn.push((event) => {
            if (
              event.key === 'Escape' ||
              event.key === 'Esc'
            ) {
              fn[i](event);
            }
          });
          break;
        }
        case 'space': {
          const i = fn.push((event) => {
            if (
              event.key === ' ' ||
              event.key === 'Spacebar'
            ) {
              fn[i](event);
            }
          });
          break;
        }
        case 'tab': {
          const i = fn.push((event) => {
            if (event.key === 'Tab') {
              fn[i](event);
            }
          });
          break;
        }
        case 'alt': {
          const i = fn.push((event) => {
            if (event.altKey) {
              fn[i](event);
            }
          });
          break;
        }
        case 'ctrl': {
          const i = fn.push((event) => {
            if (event.ctrlKey) {
              fn[i](event);
            }
          });
          break;
        }
        case 'meta': {
          const i = fn.push((event) => {
            if (event.metaKey) {
              fn[i](event);
            }
          });
          break;
        }
        case 'shift': {
          const i = fn.push((event) => {
            if (event.shiftKey) {
              fn[i](event);
            }
          });
          break;
        }
        case 'deb':
        case 'debounce': {
          let id;
          const delay = (
            (flags[flag] >= 0)
              ? +(flags[flag])
              : 250
          );
          fn[0] = (event) => {
            clearTimeout(id);
            id = setTimeout(() => {
              id = null;
              fn[1](event);
            }, delay);
          };
          break;
        }
        case 'thr':
        case 'throttle': {
          let id;
          const delay = (
            (flags[flag] >= 0)
              ? +(flags[flag])
              : 250
          );
          fn[0] = (event) => {
            if (id == null) {
              fn[1](event);
              id = setTimeout(() => {
                id = null;
              }, delay);
            }
          };
          break;
        }
        case 'capture':
        case 'once':
        case 'passive': {
          options[flag] = true;
          break;
        }
      }
    }
    fn.push(
      evaluator(`(event)=>{${expression}}`)
        .call(el.__vox)
    );
    if (!fn[1]) {
      fn[1] = fn[2];
    }
    if (!fn[0]) {
      fn[0] = fn[1];
    }
    target.addEventListener(
      key,
      fn[0],
      options
    );
    cleanup = () => {
      target.removeEventListener(
        key,
        fn[0],
        options
      );
    };
  } else {
    const obj = (
      evaluator(expression)
        .call(el.__vox)
    );
    for (const key in obj) {
      el.addEventListener(
        key,
        obj[key]
      );
    }
    cleanup = () => {
      for (const key in obj) {
        el.removeEventListener(
          key,
          obj[key]
        );
      }
    };
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
  let style = {};
  const { run, cleanup } = reaction(
    () => (
      evaluator(expression)
        .call(el.__vox)
    ),
    (value) => {
      for (const key in style) {
        el.style.removeProperty(key);
      }
      style = {};
      if (isObject(value)) {
        key = (
          (key === 'var')
            ? '--'
            : (key)
              ? `${key}-`
              : ''
        );
        for (const name in value) {
          style[key + hyphenate(name)] = value[name];
        }
      } else if (key) {
        style[key] = value;
      }
      for (const key in style) {
        let value = style[key];
        let priority;
        if (
          value
            .toString()
            .includes('important')
        ) {
          value = value.replace(
            '!important',
            ''
          );
          priority = 'important';
        }
        el.style.setProperty(
          key,
          value,
          priority
        );
      }
    }
  );
  el.__vox_cleanup.push(cleanup);
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
