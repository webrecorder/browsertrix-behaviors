import { behaviorLog, getState } from "./utils";
import * as Lib from "./utils";

// ===========================================================================
export class BackgroundBehavior {
  debug(msg) {
    behaviorLog(msg, "debug");
  }

  log(msg) {
    behaviorLog(msg, "info");
  }
}

// ===========================================================================
export class Behavior extends BackgroundBehavior {
  _running: any;
  paused: any;
  _unpause: any;
  state: any;
  scrollOpts: {
    behavior: string, block: string, inline: string
  }

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

  done() {
    return this._running ? this._running : Promise.resolve();
  }

  async run() {
    try {
      for await (const step of this) {
        this.log(step);
        if (this.paused) {
          await this.paused;
        }
      }
      this.log(this.getState("done!"));
    } catch (e) {
      this.log(this.getState(e));
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

  getState(msg, incrValue?) {
    if (incrValue) {
      if (this.state[incrValue] === undefined) {
        this.state[incrValue] = 1;
      } else {
        this.state[incrValue]++;
      }
    }

    return { state: this.state, msg };
  }

  cleanup() {

  }

  static load() {
    if (self["__bx_behaviors"]) {
      self["__bx_behaviors"].load(this);
    } else {
      console.warn(
        `Could not load ${this.name} behavior: window.__bx_behaviors is not initialized`
      );
    }
  }

  async*[Symbol.asyncIterator]() {
    yield;
  }
}

// WIP: BehaviorRunner class allows for arbitrary behavirs outside of the
// library to be run through the BehaviorManager

abstract class AbstractBehaviorInst {
  abstract run: (ctx: any) => AsyncIterable<any>;
}

interface StaticAbstractBehavior {
  id: String;
  isMatch: () => boolean;
  init: () => any;
}

type AbstractBehavior =
  (new () => AbstractBehaviorInst) & StaticAbstractBehavior;

export class BehaviorRunner extends BackgroundBehavior {
  inst: AbstractBehaviorInst;
  behaviorProps: StaticAbstractBehavior;
  ctx: any;
  _running: any;
  paused: any;
  _unpause: any;

  constructor(behavior: AbstractBehavior, mainOpts = {}) {
    super();
    this.behaviorProps = behavior;
    this.inst = new behavior;

    if (
      typeof this.inst.run !== "function" ||
      this.inst.run.constructor.name !== "AsyncGeneratorFunction"
    ) {
      throw Error("Invalid behavior: missing `async run*` instance method");
    }

    let {state, opts} = behavior.init();
    state = state || {};
    opts = opts ? {...opts, ...mainOpts} : mainOpts;
    const log = behaviorLog;

    this.ctx = { Lib, state, opts, log };

    this._running = null;
    this.paused = null;
    this._unpause = null;
  }

  start() {
    this._running = this.run();
  }

  done() {
    return this._running ? this._running : Promise.resolve();
  }

  async run() {
    try {
      for await (const step of this.inst.run(this.ctx)) {
        this.log(step);
        if (this.paused) {
          await this.paused;
        }
      }
      this.log(getState(this.ctx, "done!"));
    } catch (e) {
      this.log(getState(this.ctx, e));
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

  cleanup() {

  }

  static load() {
    if (self["__bx_behaviors"]) {
      self["__bx_behaviors"].load(this);
    } else {
      console.warn(
        `Could not load ${this.name} behavior: window.__bx_behaviors is not initialized`
      );
    }
  }
}