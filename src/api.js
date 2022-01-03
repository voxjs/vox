import { closest, define } from './utils.js';

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
          if (this.app === this) {
            return this;
          }
          index = 0;
        }
        if (index > 0 || index === 0) {
          let el = closest(
            this.el
          );
          let i = 0;
          while (el && (i < index)) {
            el = closest(
              el.parentElement
            );
            (i++);
          }
          if (el) {
            if (el.__vox_if) {
              el = el.__vox_if;
            }
            if (el.__vox_for) {
              el = el.__vox_for;
            }
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
