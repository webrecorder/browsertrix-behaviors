import { AutoFetcher } from "./autofetcher";
import { Autoplay } from "./autoplay";
import { AutoScroll } from "./autoscroll";
import { awaitLoad, sleep, behaviorLog, _setLogFunc, _setBehaviorManager, installBehaviors } from "./lib/utils";

import siteBehaviors from "./site";

// ===========================================================================
export class BehaviorManager
{
  constructor() {
    this.behaviors = [];
    this.loadedBehaviors = siteBehaviors.reduce((behaviors, next) => {
      behaviors[next.name] = next;
      return behaviors;
    }, {});
    this.mainBehavior = null;
    this.inited = false;
    this.started = false;
    behaviorLog("Loaded behaviors for: " + self.location.href);
  }

  init(opts = {autofetch: true, autoplay: true, autoscroll: true, siteSpecific: true}) {
    if (this.inited) {
      return;
    }

    this.inited = true;

    if (!self.window) {
      return;
    }

    this.timeout = opts.timeout;

    // default if omitted is 'console.log'
    if (opts.log !== undefined) {
      let logger = opts.log;
      // if string, look up as global
      if (typeof(logger) === "string") {
        logger = self[logger];
      }
      // if function, set to it
      if (typeof(logger) === "function") {
        _setLogFunc(logger);
      // if false, disable logging
      } else if (logger === false) {
        _setLogFunc(null);
      }
    }

    this.autofetch = new AutoFetcher(!!opts.autofetch);

    if (opts.autofetch) {
      behaviorLog("Enable AutoFetcher");
      this.behaviors.push(this.autofetch);
    }

    if (opts.autoplay) {
      behaviorLog("Enable Autoplay");
      this.behaviors.push(new Autoplay(this.autofetch));
    }

    let siteMatch = false;

    if (self.window.top !== self.window) {
      return;
    }

    if (opts.siteSpecific) {
      for (const name in this.loadedBehaviors) {
        const siteBehaviorClass = this.loadedBehaviors[name];
        if (siteBehaviorClass.isMatch()) {
          behaviorLog("Starting Site-Specific Behavior: " + name);
          this.mainBehaviorClass = siteBehaviorClass;
          const siteSpecificOpts = typeof opts.siteSpecific === "object" ?
            (opts.siteSpecific[name] || {}) : {};
          this.mainBehavior = new siteBehaviorClass(siteSpecificOpts);
          siteMatch = true;
          break;
        }
      }
    }

    if (!siteMatch && opts.autoscroll) {
      behaviorLog("Starting Autoscroll");
      this.mainBehaviorClass = AutoScroll;
      this.mainBehavior = new AutoScroll(this.autofetch);
    }

    if (this.mainBehavior)  {
      this.behaviors.push(this.mainBehavior);

      return this.mainBehavior.name;
    }

    return "";
  }

  load(behaviorClass) {
    this.loadedBehaviors[behaviorClass.name] = behaviorClass;
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

  async run(opts) {
    if (this.started) {
      this.unpause();
      return;
    }

    this.init(opts);

    await awaitLoad();

    if (this.mainBehavior) {
      this.mainBehavior.start();
    }

    this.started = true;

    let allBehaviors = Promise.allSettled(this.behaviors.map(x => x.done()));

    if (this.timeout) {
      behaviorLog(`Waiting for behaviors to finish or ${this.timeout}ms timeout`);
      allBehaviors = Promise.race([allBehaviors, sleep(this.timeout)]);
    } else {
      behaviorLog("Waiting for behaviors to finish");
    }

    await allBehaviors;
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
    const behavior = new siteBehaviorClass(behaviorOpts);
    behavior.start();
    console.log(`Running behavior: ${name}`);
    await behavior.done();
    console.log(`Behavior ${name} completed`);
  }

  pause() {
    behaviorLog("Pausing Main Behavior" + this.mainBehaviorClass.name);
    if (this.mainBehavior) {
      this.mainBehavior.pause();
    }
  }

  unpause() {
    // behaviorLog("Unpausing Main Behavior: " + this.mainBehaviorClass.name);
    if (this.mainBehavior) {
      this.mainBehavior.unpause();
    }
  }

  doAsyncFetch(url) {
    behaviorLog("Queueing Async Fetch Url: " + url);
    return this.autofetch.queueUrl(url);
  }
}

_setBehaviorManager(BehaviorManager);

installBehaviors(self);
