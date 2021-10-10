import {
  ReactiveEffect,
  reactive,
  readonly,
  shallowReadonly,
  toRaw as raw
} from '@vue/reactivity';

const reaction = (getter, runner) => {
  let value;
  const effect = new ReactiveEffect(
    () => {
      value = getter();
    },
    () => {
      effect.run();
      if (runner) {
        runner(value);
      }
    }
  );
  return {
    run: () => {
      effect.scheduler();
    },
    cleanup: () => {
      effect.stop();
    }
  };
};

export {
  raw,
  reaction,
  reactive,
  readonly,
  shallowReadonly
};
