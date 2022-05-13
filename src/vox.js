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
        `${q}:not(${q} *)`
      )
    );
    _.init = () => {
      for (const el of els) {
        if (!el.vox) {
          vox_init(el);
        }
      }
    };
    _.exit = () => {
      for (const el of els) {
        if (el.vox) {
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
      if (el && !el.vox) {
        vox_init(el);
      }
    };
    _.exit = () => {
      if (el && el.vox) {
        vox_exit(el);
      }
    };
  }
  return (_);
};

const vox_init = (el) => {
  if (!el.vox) {
    el.vox = context(
      readonly({ el }),
      ...(el.parentNode.vox || app())
        .data.slice(1)
    );
  }
  if (!el.vox_cleanup) {
    el.vox_cleanup = [];
  }
  if (!el.vox_init) {
    el.vox_init = [];
  }
  if (!el.vox_exit) {
    el.vox_exit = [];
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
            .call(el.vox)
        )) {
          vox_exit(el);
          return;
        }
        break;
      }
      case 'vox': {
        if (!el.vox_for && !el.vox_if) {
          const { app, vox } = (
            el.vox.data.pop()
          );
          el.vox.data.splice(
            1, 0,
            reactive(
              evaluator(`(api)=>{with(api)return(${expression})}`)
                .call(el.vox)(api)
            )
          );
          el.vox.data.push(
            shallowReadonly({
              app,
              els: readonly({}),
              vox: (index = 0) => (
                (index === 0)
                  ? el.vox
                  : (index > 0)
                    ? vox(index - 1)
                    : void(0)
              )
            })
          );
          if (el.vox.data[1].init) {
            el.vox_init.push(
              el.vox.init.bind(el.vox)
            );
            el.vox.init();
          }
          if (el.vox.data[1].exit) {
            el.vox_exit.push(
              el.vox.exit.bind(el.vox)
            );
          }
        }
        break;
      }
      case 'for': {
        if (!el.vox_for) {
          vox_for(el, expression);
          return;
        }
        break;
      }
      case 'if': {
        if (!el.vox_if) {
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
            .call(el.vox)
        );
        el.vox_init.push(init);
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
        el.vox_exit.push(
          evaluator(`()=>{${expression}}`)
            .call(el.vox)
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
  (el.vox_content || (
    el.vox_content = (
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
          .call(el.vox)
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
      while (content[i] && value[i]) {
        const data = (
          content[i]
            .vox
            .data[1]
        );
        if (vars[0]) {
          define(data, {
            [vars[0]]: {
              writable: true
            }
          });
          extend(data, {
            [vars[0]]: value[i][1]
          });
          define(data, {
            [vars[0]]: {
              writable: false
            }
          });
        }
        if (vars[1]) {
          define(data, {
            [vars[1]]: {
              writable: true
            }
          });
          extend(data, {
            [vars[1]]: value[i][0]
          });
          define(data, {
            [vars[1]]: {
              writable: false
            }
          });
        }
        if (vars[2]) {
          define(data, {
            [vars[2]]: {
              writable: true
            }
          });
          extend(data, {
            [vars[2]]: i
          });
          define(data, {
            [vars[2]]: {
              writable: false
            }
          });
        }
        (i++);
      }
      while (!content[i] && value[i]) {
        const clone = el.cloneNode(true);
        const scope = {};
        if (vars[0]) {
          define(scope, {
            [vars[0]]: {
              value: value[i][1],
              configurable: true,
              enumerable: true
            }
          });
        }
        if (vars[1]) {
          define(scope, {
            [vars[1]]: {
              value: value[i][0],
              configurable: true,
              enumerable: true
            }
          });
        }
        if (vars[2]) {
          define(scope, {
            [vars[2]]: {
              value: i,
              configurable: true,
              enumerable: true
            }
          });
        }
        node.parentNode.insertBefore(clone, node);
        content[i] = clone;
        clone.vox = context(
          readonly({
            el: clone
          }),
          reactive(scope),
          ...el.vox.data.slice(1)
        );
        clone.vox_for = el;
        vox_init(clone);
        (i++);
      }
      while (content[i] && !value[i]) {
        const clone = content[i];
        vox_exit(clone);
        content[i] = null;
        clone.parentNode.removeChild(clone);
        (i++);
      }
      content.length = value.length;
    }
  );
  el.vox_for = el;
  el.vox_content = content;
  el.vox_cleanup.push(() => {
    cleanup();
    content.forEach((clone) => {
      clone.parentNode.removeChild(clone);
    });
    node.parentNode.replaceChild(el, node);
  });
  el.parentNode.replaceChild(node, el);
  run();
};

const vox_if = (el, expression) => {
  let condition = false;
  const content = [];
  const node = document.createTextNode('');
  const clone = el.cloneNode(true);
  const { run, cleanup } = reaction(
    () => (
      evaluator(`!!(${expression})`)
        .call(el.vox)
    ),
    (value) => {
      if (condition !== value) {
        condition = value;
        if (condition) {
          node.parentNode.insertBefore(clone, node);
          content.push(clone);
          clone.vox = context(
            readonly({
              el: clone
            }),
            ...el.vox.data.slice(1)
          );
          if (el.vox_for) {
            clone.vox_for = el.vox_for;
          }
          clone.vox_if = el;
          vox_init(clone);
        } else {
          vox_exit(clone);
          content.pop();
          clone.parentNode.removeChild(clone);
        }
      }
    }
  );
  el.vox_if = el;
  el.vox_content = content;
  el.vox_cleanup.push(() => {
    cleanup();
    if (condition) {
      clone.parentNode.removeChild(clone);
    }
    node.parentNode.replaceChild(el, node);
  });
  el.parentNode.replaceChild(node, el);
  run();
};

const vox_el = (el, expression) => {
  const name = (
    evaluator(expression)
      .call(el.vox)
  );
  const { els } = raw(
    el.vox.data[
      el.vox.data.length - 1
    ]
  );
  define(els, {
    [name]: {
      value: el,
      configurable: true,
      enumerable: true
    }
  });
  el.vox_cleanup.push(() => {
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
        .call(el.vox)
    ),
    (value) => {
      const attrs = (
        (key)
          ? { [key]: value }
          : value
      );
      for (let key in attrs) {
        const value = attrs[key];
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
  el.vox_cleanup.push(cleanup);
  run();
};

const vox_bind = (el, expression, key) => {
  const { run, cleanup } = reaction(
    () => (
      evaluator(expression)
        .call(el.vox)
    ),
    (value) => {
      el[key] = value;
    }
  );
  if (
    key === 'innerHTML' ||
    key === 'textContent'
  ) {
    el.vox_content = [];
  }
  el.vox_cleanup.push(cleanup);
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
        .call(el.vox)
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
  el.vox_cleanup.push(cleanup);
  run();
};

const vox_event = (el, expression, key, flags) => {
  let cleanup;
  if (key) {
    let target = el;
    const handler = (
      evaluator(`(event)=>{with(event){${expression}}}`)
        .call(el.vox)
    );
    const event = new Array(2);
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
          event[1] = (e) => {
            if (!el.contains(e.target)) {
              event[2](e);
            }
          };
          break;
        }
        case 'self': {
          const i = event.push((e) => {
            if (e.target === el) {
              event[i](e);
            }
          });
          break;
        }
        case 'prevent': {
          const i = event.push((e) => {
            e.preventDefault();
            event[i](e);
          });
          break;
        }
        case 'stop': {
          const i = event.push((e) => {
            e.stopPropagation();
            event[i](e);
          });
          break;
        }
        case 'immediate': {
          const i = event.push((e) => {
            e.stopImmediatePropagation();
            event[i](e);
          });
          break;
        }
        case 'left': {
          const i = event.push((e) => {
            if (
              e.button === 0 ||
              e.key === 'ArrowLeft' ||
              e.key === 'Left'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'mid':
        case 'middle': {
          const i = event.push((e) => {
            if (e.button === 1) {
              event[i](e);
            }
          });
          break;
        }
        case 'right': {
          const i = event.push((e) => {
            if (
              e.button === 2 ||
              e.key === 'ArrowRight' ||
              e.key === 'Right'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'up': {
          const i = event.push((e) => {
            if (
              e.key === 'ArrowUp' ||
              e.key === 'Up'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'down': {
          const i = event.push((e) => {
            if (
              e.key === 'ArrowDown' ||
              e.key === 'Down'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'del':
        case 'delete': {
          const i = event.push((e) => {
            if (
              e.key === 'Backspace' ||
              e.key === 'Delete' ||
              e.key === 'Del'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'enter': {
          const i = event.push((e) => {
            if (e.key === 'Enter') {
              event[i](e);
            }
          });
          break;
        }
        case 'esc':
        case 'escape': {
          const i = event.push((e) => {
            if (
              e.key === 'Escape' ||
              e.key === 'Esc'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'space': {
          const i = event.push((e) => {
            if (
              e.key === ' ' ||
              e.key === 'Spacebar'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'tab': {
          const i = event.push((e) => {
            if (e.key === 'Tab') {
              event[i](e);
            }
          });
          break;
        }
        case 'alt': {
          const i = event.push((e) => {
            if (e.altKey) {
              event[i](e);
            }
          });
          break;
        }
        case 'ctrl': {
          const i = event.push((e) => {
            if (e.ctrlKey) {
              event[i](e);
            }
          });
          break;
        }
        case 'meta': {
          const i = event.push((e) => {
            if (e.metaKey) {
              event[i](e);
            }
          });
          break;
        }
        case 'shift': {
          const i = event.push((e) => {
            if (e.shiftKey) {
              event[i](e);
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
          event[0] = (e) => {
            clearTimeout(id);
            id = setTimeout(() => {
              id = null;
              event[1](e);
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
          event[0] = (e) => {
            if (id == null) {
              event[1](e);
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
    event.push((e) => {
      handler({
        event: e,
        ...e.detail
      });
    });
    if (!event[1]) {
      event[1] = event[2];
    }
    if (!event[0]) {
      event[0] = event[1];
    }
    target.addEventListener(
      key,
      event[0],
      options
    );
    cleanup = () => {
      target.removeEventListener(
        key,
        event[0],
        options
      );
    };
  } else {
    const events = (
      evaluator(expression)
        .call(el.vox)
    );
    for (const key in events) {
      const handler = events[key];
      el.addEventListener(
        key,
        events[key] = (e) => {
          handler.call(
            el.vox,
            e,
            e.detail
          );
        }
      );
    }
    cleanup = () => {
      for (const key in events) {
        el.removeEventListener(
          key,
          events[key]
        );
      }
    };
  }
  el.vox_cleanup.push(cleanup);
};

const vox_focus = (el, expression) => {
  let condition = false;
  let element;
  const { run, cleanup } = reaction(
    () => (
      evaluator(`!!(${expression})`)
        .call(el.vox)
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
  el.vox_cleanup.push(cleanup);
  run();
};

const vox_run = (el, expression) => {
  const { run, cleanup } = reaction(
    evaluator(`()=>{${expression}}`)
      .call(el.vox)
  );
  el.vox_cleanup.push(cleanup);
  run();
};

const vox_style = (el, expression, key, flags) => {
  let style = {};
  const { run, cleanup } = reaction(
    () => (
      evaluator(expression)
        .call(el.vox)
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
  el.vox_cleanup.push(cleanup);
  run();
};

const vox_exit = (el) => {
  if (el.vox_content) {
    el.vox_content.forEach(vox_exit);
    delete el.vox_content;
  }
  if (el.vox_cleanup) {
    el.vox_cleanup.forEach(
      (cleanup) => cleanup()
    );
    delete el.vox_cleanup;
  }
  if (el.vox) {
    delete el.vox;
  }
  if (el.vox_for) {
    delete el.vox_for;
  }
  if (el.vox_if) {
    delete el.vox_if;
  }
  if (el.vox_init) {
    delete el.vox_init;
  }
  if (el.vox_exit) {
    el.vox_exit.forEach(
      (exit) => exit()
    );
    delete el.vox_exit;
  }
};

export { vox };
