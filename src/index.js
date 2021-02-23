import { AutoFetcher } from "./autofetcher";
import { Autoplay } from "./autoplay";
import { AutoScroll } from "./autoscroll";
import { runOnload } from "./lib/utils";

export class BehaviorManager
{
  constructor() {
    this.behaviors = [];
  }

  run(opts = {}) {
    if (opts.autofetch) {
      this.behaviors.push(new AutoFetcher());
    }

    if (opts.autoplay) {
      this.behaviors.push(new Autoplay());
    }

    if (opts.autoscroll) {
      this.behaviors.push(new AutoScroll());
    }

    runOnload(() => {
      for (const behavior of this.behaviors) {
        behavior.init();
      }
    });
  }

  done() {
    return Promise.all(this.behaviors.map(x => x.done()));
  }
}

self.__wb_behaviors = new BehaviorManager();
