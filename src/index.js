import { AutoFetcher } from "./autofetcher";
import { Autoplay } from "./autoplay";
import { AutoScroll } from "./autoscroll";
import { awaitLoad, sleep, behavior_log, _setLogFunc, _setBehaviorManager, installBehaviors } from "./lib/utils";

import siteBehaviors from "./site";

_setBehaviorManager(BehaviorManager);


// ===========================================================================
export class BehaviorManager
{
  constructor() {
    this.behaviors = [];
    this.mainBehavior = null;
    this.inited = false;
    this.started = false;
    behavior_log("Loaded behaviors for: " + self.location.href);
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

    console.log("logger", typeof(opts.log), opts.log, self[opts.log]);

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
      behavior_log("Enable AutoFetcher");
      this.behaviors.push(new AutoFetcher());
    }

    if (opts.autoplay) {
      behavior_log("Enable Autoplay");
      this.behaviors.push(new Autoplay());
    }

    let siteMatch = false;

    if (self.window.top !== self.window) {
      return;
    }

    if (opts.siteSpecific) {
      for (const siteBehaviorClass of siteBehaviors) {
        if (siteBehaviorClass.isMatch()) {
          behavior_log("Starting Site-Specific Behavior: " + siteBehaviorClass.name);
          this.mainBehaviorClass = siteBehaviorClass;
          this.mainBehavior = new siteBehaviorClass();
          siteMatch = true;
          break;
        }
      }
    } 

    if (!siteMatch && opts.autoscroll) {
      behavior_log("Starting Autoscroll");
      this.mainBehaviorClass = AutoScroll;
      this.mainBehavior = new AutoScroll();
    }

    if (this.mainBehavior)  {
      this.behaviors.push(this.mainBehavior);
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
      behavior_log(`Waiting for behaviors to finish or ${this.timeout}ms timeout`);
      allBehaviors = Promise.race([allBehaviors, sleep(this.timeout)]);
    } else {
      behavior_log("Waiting for behaviors to finish");
    }

    await allBehaviors;
    behavior_log("All Behaviors Done!");

    if (this.mainBehavior && this.mainBehaviorClass.cleanup) {
      this.mainBehavior.cleanup();
    }
  }

  pause() {
    behavior_log("Pausing Main Behavior" + this.mainBehaviorClass.name);
    if (this.mainBehavior) {
      this.mainBehavior.pause();
    }
  }

  unpause() {
    behavior_log("Unpausing Main Behavior: " + this.mainBehaviorClass.name);
    if (this.mainBehavior) {
      this.mainBehavior.unpause();
    }
  }
}

installBehaviors(self);
