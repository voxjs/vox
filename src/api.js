import { define } from './utils.js';

const api = define({}, {
  app: {
    value: {
      emit(event, detail) {
        (this.el || document)
          .dispatchEvent(
            new CustomEvent(event, {
              bubbles: true,
              cancelable: true,
              composed: true,
              detail
            })
          );
      },
      vox(index) {
        if (index === void(0)) {
          return this;
        }
        if (index > 0 || index === 0) {
          let el = this.el;
          let i = 0;
          while (el && (i < index)) {
            el = el.parentElement;
            (i++);
          }
          if (el) {
            return el.__vox;
          }
        }
      }
    },
    configurable: true,
    enumerable: true
  }
});

export { api };
