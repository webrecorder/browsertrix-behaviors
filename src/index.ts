import { AutoFetcher } from "./autofetcher";
import { Autoplay } from "./autoplay";
import { AutoScroll } from "./autoscroll";
import { awaitLoad, sleep, behaviorLog, _setLogFunc, _setBehaviorManager, installBehaviors } from "./lib/utils";
import { Behavior, BehaviorRunner } from "./lib/behavior";

import siteBehaviors from "./site";

// ===========================================================================
// ====                  Behavior Manager                        ====
// ===========================================================================
//

interface BehaviorManagerOpts {
  autofetch?: boolean;
  autoplay?: boolean;
  autoscroll?: boolean;
  log?: ((...message: string[]) => void) | string | false;
  siteSpecific?: boolean | object;
  timeout?: number;
  fetchHeaders?: object | null;
  startEarly?: boolean | null;
}

const DEFAULT_OPTS: BehaviorManagerOpts = {autofetch: true, autoplay: true, autoscroll: true, siteSpecific: true};

export class BehaviorManager {
  autofetch: AutoFetcher;
  behaviors: any[];
  loadedBehaviors: any;
  mainBehavior: Behavior | BehaviorRunner | null;
  mainBehaviorClass: any;
  inited: boolean;
  started: boolean;
  timeout?: number;
  opts?: BehaviorManagerOpts;

  constructor() {
    this.behaviors = [];
    this.loadedBehaviors = siteBehaviors.reduce((behaviors, next) => {
      behaviors[next.id] = next;
      return behaviors;
    }, {});
    this.mainBehavior = null;
    this.inited = false;
    this.started = false;
    behaviorLog("Loaded behaviors for: " + self.location.href);
  }

  init(opts: BehaviorManagerOpts = DEFAULT_OPTS, restart = false, customBehaviors: any[] = null) {
    if (this.inited && !restart) {
      return;
    }

    this.inited = true;
    this.opts = opts;

    if (!self.window) {
      return;
    }

    this.timeout = opts.timeout;

    // default if omitted is 'console.log'
    if (opts.log !== undefined) {
      let logger = opts.log;
      // if string, look up as global
      if (typeof (logger) === "string") {
        logger = self[logger];
      }
      // if function, set to it
      if (typeof (logger) === "function") {
        _setLogFunc(logger);
        // if false, disable logging
      } else if (logger === false) {
        _setLogFunc(null);
      }
    }

    this.autofetch = new AutoFetcher(!!opts.autofetch, opts.fetchHeaders, opts.startEarly);

    if (opts.autofetch) {
      behaviorLog("Using AutoFetcher");
      this.behaviors.push(this.autofetch);
    }

    if (opts.autoplay) {
      behaviorLog("Using Autoplay");
      this.behaviors.push(new Autoplay(this.autofetch, opts.startEarly));
    }

    if (!this.isInTopFrame()) {
      return;
    }

    if (customBehaviors) {
      for (const behaviorClass of customBehaviors) {
        try {
          this.load(behaviorClass);
        } catch (e) {
          behaviorLog(`Failed to load custom behavior: ${e} ${behaviorClass}`);
        }
      }
    }
  }

  selectMainBehavior() {
    if (this.mainBehavior) {
      return;
    }
    const opts = this.opts;
    let siteMatch = false;

    if (opts.siteSpecific) {
      for (const name in this.loadedBehaviors) {
        const siteBehaviorClass = this.loadedBehaviors[name];
        if (siteBehaviorClass.isMatch()) {
          behaviorLog("Using Site-Specific Behavior: " + name);
          this.mainBehaviorClass = siteBehaviorClass;
          const siteSpecificOpts = typeof opts.siteSpecific === "object" ?
            (opts.siteSpecific[name] || {}) : {};
          try {
            this.mainBehavior = new BehaviorRunner(siteBehaviorClass, siteSpecificOpts);
          } catch (e) {
            behaviorLog(e.toString(), "error");
          }
          siteMatch = true;
          break;
        }
      }
    }

    if (!siteMatch && opts.autoscroll) {
      behaviorLog("Using Autoscroll");
      this.mainBehaviorClass = AutoScroll;
      this.mainBehavior = new AutoScroll(this.autofetch);
    }

    if (this.mainBehavior) {
      this.behaviors.push(this.mainBehavior);

      if (this.mainBehavior instanceof BehaviorRunner) {
        return this.mainBehavior.behaviorProps.id;
      }
    }

    return "";
  }

  load(behaviorClass) {
    if (typeof(behaviorClass) !== "function") {
      behaviorLog(`Must pass a class object, got ${behaviorClass}`, "error");
      return;
    }

    if (typeof(behaviorClass.id) !== "string") {
      behaviorLog("Behavior class must have a string string \"id\" property", "error");
      return;
    }

    if (
      typeof(behaviorClass.isMatch) !== "function" ||
      typeof(behaviorClass.init) !== "function"
    ) {
      behaviorLog("Behavior class must have an is `isMatch()` and `init()` static methods", "error");
      return;
    }

    const name = behaviorClass.id;
    behaviorLog(`Loading external class ${name}: ${behaviorClass}`, "debug");
    this.loadedBehaviors[name] = behaviorClass;
  }

  async resolve(target) {
    const imported = await import(`${target}`); // avoid Webpack warning
    if (Array.isArray(imported)) {
      for (const behavior of imported) {
        this.load(behavior);
      }
    } else {
      this.load(imported);
    }
  }

  async awaitPageLoad() {
    this.selectMainBehavior();
    if (this.mainBehavior?.awaitPageLoad) {
      await this.mainBehavior.awaitPageLoad();
    }
  }

  async run(opts: BehaviorManagerOpts = DEFAULT_OPTS, restart = false) {
    if (restart) {
      this.started = false;
    }

    if (this.started) {
      this.unpause();
      return;
    }

    this.init(opts, restart);
    this.selectMainBehavior();

    await awaitLoad();

    this.behaviors.forEach(x => {
      behaviorLog("Starting behavior: " + x.constructor.id || "(Unnamed)");
      x.start();
    });

    this.started = true;

    await sleep(500);

    let allBehaviors = Promise.allSettled(this.behaviors.map(x => x.done()));

    if (this.timeout) {
      behaviorLog(`Waiting for behaviors to finish or ${this.timeout}ms timeout`);
      await Promise.race([allBehaviors, sleep(this.timeout)]);
    } else {
      behaviorLog("Waiting for behaviors to finish");
      await allBehaviors;
    }

    behaviorLog("All Behaviors Done for " + self.location.href);

    if (this.mainBehavior && this.mainBehaviorClass.cleanup) {
      this.mainBehavior.cleanup();
    }
  }

  async runOne(name, behaviorOpts = {}) {
    const siteBehaviorClass = siteBehaviors.find(b => b.name === name);
    if (typeof siteBehaviorClass === "undefined") {
      console.error(`No behavior of name ${name} found`);
      return;
    }
    //const behavior = new siteBehaviorClass(behaviorOpts);
    const behavior = new BehaviorRunner(siteBehaviorClass, behaviorOpts);
    behavior.start();
    console.log(`Running behavior: ${name}`);
    await behavior.done();
    console.log(`Behavior ${name} completed`);
  }

  pause() {
    behaviorLog("Pausing Main Behavior" + this.mainBehaviorClass.name);
    this.behaviors.forEach(x => x.pause());
  }

  unpause() {
    // behaviorLog("Unpausing Main Behavior: " + this.mainBehaviorClass.name);
    this.behaviors.forEach(x => x.unpause());
  }

  doAsyncFetch(url) {
    behaviorLog("Queueing Async Fetch Url: " + url);
    return this.autofetch.queueUrl(url, true);
  }

  isInTopFrame() {
    return self.window.top === self.window || window["__WB_replay_top"] === self.window;
  }
}


_setBehaviorManager(BehaviorManager);

installBehaviors(self);
