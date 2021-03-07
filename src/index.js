import { AutoFetcher } from "./autofetcher";
import { Autoplay } from "./autoplay";
import { AutoScroll } from "./autoscroll";
import { runOnload, sleep, behavior_log } from "./lib/utils";

import siteBehaviors from "./site";


// ===========================================================================
export class BehaviorManager
{
  constructor() {
    this.behaviors = [];
    this.mainBehavior = null;
    behavior_log("Behaviors in:" + self.location.href);
  }

  init(opts = {}) {
    if (!self.window) {
      return;
    }

    this.timeout = opts.timeout;

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
          this.mainBehavior = new siteBehaviorClass();
          siteMatch = true;
          break;
        }
      }
    } 

    if (!siteMatch && opts.autoscroll) {
      behavior_log("Starting Autoscroll");
      this.mainBehavior = new AutoScroll();
    }

    if (this.mainBehavior)  {
      this.behaviors.push(this.mainBehavior);
    }
  }

  run() {
    runOnload(() => {
      if (this.mainBehavior) {
        this.mainBehavior.start();
      }
    });

    const allBehaviors = Promise.all(this.behaviors.map(x => x.done()));

    if (this.timeout) {
      behavior_log(`Waiting for behaviors to finish or ${this.timeout}ms timeout`);
      return Promise.race([allBehaviors, sleep(this.timeout)]);
    } else {
      behavior_log(`Waiting for behaviors to finish`);
      return allBehaviors;
    }
  }

  pause() {
    console.log("pausing");
    if (this.mainBehavior) {
      this.mainBehavior.pause();
    }
  }

  unpause() {
    console.log("unpausing");
    if (this.mainBehavior) {
      this.mainBehavior.unpause();
    }
  }
}

self.__wb_behaviors = new BehaviorManager();
