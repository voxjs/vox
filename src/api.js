import { define, isString } from './utils.js';

const api = define({}, {
  app: {
    value: {
      emit(event, detail) {
        (this.el || document)
          .dispatchEvent(
            new CustomEvent(event, {
              bubbles: true,
              cancelable: true,
              detail
            })
          );
      },
      vox(q) {
        if (q === void(0)) {
          return this;
        }
        let element;
        if (isString(q)) {
          element = (
            document.querySelector(q)
          );
        } else if (q >= 0) {
          element = this.el;
          let i = 0;
          while (element && (i < q)) {
            element = element.parentElement;
            (i++);
          }
        } else {
          element = q;
        }
        if (element) {
          return element.__vox;
        }
      }
    },
    configurable: true,
    enumerable: true
  }
});

export { api };
