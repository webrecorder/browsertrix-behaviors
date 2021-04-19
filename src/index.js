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

    if (opts.autofetch) {
      behaviorLog("Enable AutoFetcher");
      this.behaviors.push(new AutoFetcher());
    }

    if (opts.autoplay) {
      behaviorLog("Enable Autoplay");
      this.behaviors.push(new Autoplay());
    }

    let siteMatch = false;

    if (self.window.top !== self.window) {
      return;
    }

    if (opts.siteSpecific) {
      for (const siteBehaviorClass of siteBehaviors) {
        if (siteBehaviorClass.isMatch()) {
          behaviorLog("Starting Site-Specific Behavior: " + siteBehaviorClass.name);
          this.mainBehaviorClass = siteBehaviorClass;
          this.mainBehavior = new siteBehaviorClass();
          siteMatch = true;
          break;
        }
      }
    } 

    if (!siteMatch && opts.autoscroll) {
      behaviorLog("Starting Autoscroll");
      this.mainBehaviorClass = AutoScroll;
      this.mainBehavior = new AutoScroll();
    }

    if (this.mainBehavior)  {
      this.behaviors.push(this.mainBehavior);

      return this.mainBehavior.name;
    }

    return "";
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
    behaviorLog("All Behaviors Done!");

    if (this.mainBehavior && this.mainBehaviorClass.cleanup) {
      this.mainBehavior.cleanup();
    }
  }

  pause() {
    behaviorLog("Pausing Main Behavior" + this.mainBehaviorClass.name);
    if (this.mainBehavior) {
      this.mainBehavior.pause();
    }
  }

  unpause() {
    behaviorLog("Unpausing Main Behavior: " + this.mainBehaviorClass.name);
    if (this.mainBehavior) {
      this.mainBehavior.unpause();
    }
  }
}

_setBehaviorManager(BehaviorManager);

installBehaviors(self);
