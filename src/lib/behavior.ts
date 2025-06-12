import { behaviorLog } from "./utils";
import * as Lib from "./utils";

// ===========================================================================
export class BackgroundBehavior {
  debug(msg) {
    behaviorLog(msg, "debug");
  }

  error(msg) {
    behaviorLog(msg, "error");
  }

  log(msg, type = "info") {
    behaviorLog(msg, type);
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

  done() {
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
      this.error(e.toString());
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

  getState(msg: string, incrValue?) {
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

  async awaitPageLoad(_: any) {
    // wait for initial page load here
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

// WIP: BehaviorRunner class allows for arbitrary behaviors outside of the
// library to be run through the BehaviorManager

abstract class AbstractBehaviorInst {
  abstract run: (ctx: any) => AsyncIterable<any>;

  abstract awaitPageLoad?: (ctx: any) => Promise<void>;
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

  get id() {
    return (this.inst?.constructor as any).id;
  }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const log = async (data: any, type: string) => this.wrappedLog(data, type);

    this.ctx = { Lib, state, opts, log };

    this._running = null;
    this.paused = null;
    this._unpause = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wrappedLog(data: any, type = "info") {
    let logData;
    if (typeof data === "string" || data instanceof String) {
      logData = {msg: data}
    } else {
      logData = data;
    }
    this.log({...logData, behavior: this.behaviorProps.id, siteSpecific: true}, type);
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
        if (step) {
          this.wrappedLog(step);
        }
        if (this.paused) {
          await this.paused;
        }
      }
      this.debug({msg: "done!", behavior: this.behaviorProps.id});
    } catch (e) {
      this.error({msg: e.toString(), behavior: this.behaviorProps.id});
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
        `Could not load ${this.name} behavior: window.__bx_behaviors is not initialized`
      );
    }
  }
}
