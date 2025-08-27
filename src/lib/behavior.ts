import { behaviorLog } from "./utils";
import * as Lib from "./utils";

// ===========================================================================
export class BackgroundBehavior {
  debug(msg: unknown) {
    void behaviorLog(msg, "debug");
  }

  error(msg: unknown) {
    void behaviorLog(msg, "error");
  }

  log(msg: unknown, type = "info") {
    void behaviorLog(msg, type);
  }
}

// ===========================================================================
export class Behavior extends BackgroundBehavior {
  _running: Promise<void> | null;
  paused: any;
  _unpause: any;
  state: any;
  scrollOpts: {
    behavior: string;
    block: string;
    inline: string;
  };

  constructor() {
    super();
    this._running = null;
    this.paused = null;
    this._unpause = null;
    this.state = {};

    this.scrollOpts = { behavior: "smooth", block: "center", inline: "center" };
  }

  start() {
    this._running = this.run();
  }

  async done() {
    return this._running ? this._running : Promise.resolve();
  }

  async run() {
    try {
      for await (const step of this) {
        this.debug(step);
        if (this.paused) {
          await this.paused;
        }
      }
      this.debug(this.getState("done!"));
    } catch (e) {
      this.error((e as Error).toString());
    }
  }

  pause() {
    if (this.paused) {
      return;
    }
    this.paused = new Promise((resolve) => {
      this._unpause = resolve;
    });
  }

  unpause() {
    if (this._unpause) {
      this._unpause();
      this.paused = null;
      this._unpause = null;
    }
  }

  getState(msg: string, incrValue?: string) {
    if (incrValue) {
      if (this.state[incrValue] === undefined) {
        this.state[incrValue] = 1;
      } else {
        this.state[incrValue]++;
      }
    }

    return { state: this.state, msg };
  }

  cleanup() {}

  async awaitPageLoad(_: any) {
    // wait for initial page load here
  }

  static load() {
    if (self["__bx_behaviors"]) {
      self["__bx_behaviors"].load(this);
    } else {
      console.warn(
        `Could not load ${this.name} behavior: window.__bx_behaviors is not initialized`,
      );
    }
  }

  async *[Symbol.asyncIterator]() {
    yield;
  }
}

// WIP: BehaviorRunner class allows for arbitrary behaviors outside of the
// library to be run through the BehaviorManager

export type EmptyObject = Record<string, never>;

export type Context<State, Opts = EmptyObject> = {
  Lib: typeof Lib;
  state: State;
  opts: Opts;
  log: (data: any, type?: string) => Promise<void>;
};

export abstract class AbstractBehavior<State, Opts = EmptyObject> {
  static readonly id: string;
  static isMatch: () => boolean;
  static init: () => any;

  abstract run: (
    ctx: Context<State, Opts>,
  ) => AsyncIterable<{ state?: State }> | Promise<void>;

  abstract [Symbol.asyncIterator]?(): AsyncIterable<void>;

  abstract awaitPageLoad?: (ctx: Context<State, Opts>) => Promise<void>;
}

type StaticProps<T> = {
  [K in keyof T]: T[K];
};

type StaticBehaviorProps = StaticProps<typeof AbstractBehavior>;

// Non-abstract constructor type
type ConcreteBehaviorConstructor<State, Opts> = StaticBehaviorProps & {
  new (): AbstractBehavior<State, Opts>;
};

export class BehaviorRunner<State, Opts>
  extends BackgroundBehavior
  implements AbstractBehavior<State, Opts>
{
  inst: AbstractBehavior<State, Opts>;
  behaviorProps: ConcreteBehaviorConstructor<State, Opts>;
  ctx: Context<State, Opts>;
  _running: any;
  paused: any;
  _unpause: any;

  get id() {
    return (this.inst.constructor as ConcreteBehaviorConstructor<State, Opts>)
      .id;
  }

  constructor(
    behavior: ConcreteBehaviorConstructor<State, Opts>,
    mainOpts = {},
  ) {
    super();
    this.behaviorProps = behavior;
    this.inst = new behavior();

    if (
      typeof this.inst.run !== "function" ||
      this.inst.run.constructor.name !== "AsyncGeneratorFunction"
    ) {
      throw Error("Invalid behavior: missing `async run*` instance method");
    }

    let { state, opts } = behavior.init();
    state = state || {};
    opts = opts ? { ...opts, ...mainOpts } : mainOpts;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const log = async (data: any, type?: string) => this.wrappedLog(data, type);

    this.ctx = { Lib, state, opts, log };

    this._running = null;
    this.paused = null;
    this._unpause = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wrappedLog(data: any, type = "info") {
    let logData;
    if (typeof data === "string" || data instanceof String) {
      logData = { msg: data };
    } else {
      logData = data;
    }
    this.log(
      { ...logData, behavior: this.behaviorProps.id, siteSpecific: true },
      type,
    );
  }

  start() {
    this._running = this.run();
  }

  done() {
    return this._running ? this._running : Promise.resolve();
  }

  async run() {
    try {
      // @ts-expect-error TODO how does this work for behaviors where `run` isn't an iterator, e.g. Autoplay and Autoscroll?
      for await (const step of this.inst.run(this.ctx)) {
        if (step) {
          this.wrappedLog(step);
        }
        if (this.paused) {
          await this.paused;
        }
      }
      this.debug({ msg: "done!", behavior: this.behaviorProps.id });
    } catch (e) {
      this.error({
        msg: (e as Error).toString(),
        behavior: this.behaviorProps.id,
      });
    }
  }

  pause() {
    if (this.paused) {
      return;
    }
    this.paused = new Promise((resolve) => {
      this._unpause = resolve;
    });
  }

  unpause() {
    if (this._unpause) {
      this._unpause();
      this.paused = null;
      this._unpause = null;
    }
  }

  cleanup() {}

  async awaitPageLoad() {
    if (this.inst.awaitPageLoad) {
      await this.inst.awaitPageLoad(this.ctx);
    }
  }

  static load() {
    if (self["__bx_behaviors"]) {
      self["__bx_behaviors"].load(this);
    } else {
      console.warn(
        `Could not load ${this.name} behavior: window.__bx_behaviors is not initialized`,
      );
    }
  }
}
