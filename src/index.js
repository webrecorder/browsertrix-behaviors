import { AutoFetcher } from "./autofetcher";
import { Autoplay } from "./autoplay";
import { AutoScroll } from "./autoscroll";
import { runOnload, sleep } from "./lib/utils";

import siteBehaviors from "./site";


// ===========================================================================
export class BehaviorManager
{
  constructor() {
    this.behaviors = [];
    this.mainBehavior = null;
  }

  init(opts = {}) {
    if (opts.autofetch) {
      this.behaviors.push(new AutoFetcher());
    }

    if (opts.autoplay) {
      this.behaviors.push(new Autoplay());
    }

    let siteMatch = false;

    if (opts.siteSpecific) {
      for (const siteBehaviorClass of siteBehaviors) {
        if (siteBehaviorClass.isMatch()) {
          console.log("Starting Site-Specific Behavior: " + siteBehaviorClass.name);
          this.mainBehavior = new siteBehaviorClass();
          siteMatch = true;
          break;
        }
      }
    } 

    if (!siteMatch && opts.autoscroll) {
      this.mainBehavior = new AutoScroll();
    }

    if (this.mainBehavior)  {
      this.behaviors.push(this.mainBehavior);
    }

    this.timeout = opts.timeout;
  }

  start() {
    runOnload(() => {
      if (this.mainBehavior) {
        this.mainBehavior.start();
      }
    });
  }

  done() {
    const allBehaviors = Promise.all(this.behaviors.map(x => x.done()));

    if (this.timeout) {
      return Promise.race([allBehaviors, sleep(this.timeout)]);
    } else {
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
