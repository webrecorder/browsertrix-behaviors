import { AutoFetcher } from "./autofetcher";
import { Autoplay } from "./autoplay";
import { AutoScroll } from "./autoscroll";
import { AutoClick } from "./autoclick";
import { awaitLoad, sleep, behaviorLog, _setLogFunc, _setBehaviorManager, installBehaviors, addLink, checkToJsonOverride } from "./lib/utils";
import { type Behavior, BehaviorRunner } from "./lib/behavior";
import * as Lib from "./lib/utils";


import siteBehaviors from "./site";

// ===========================================================================
// ====                  Behavior Manager                        ====
// ===========================================================================
//

interface BehaviorManagerOpts {
  autofetch?: boolean;
  autoplay?: boolean;
  autoscroll?: boolean;
  autoclick?: boolean;
  log?: ((...message: string[]) => void) | string | false;
  siteSpecific?: boolean | object;
  timeout?: number;
  fetchHeaders?: object | null;
  startEarly?: boolean | null;
  clickSelector?: string;
}

type LinkOpts = {
  selector: string;
  extractName: string;
  attrOnly?: boolean;
};

const DEFAULT_OPTS: BehaviorManagerOpts = {autofetch: true, autoplay: true, autoscroll: true, autoclick: true, siteSpecific: true};

const DEFAULT_CLICK_SELECTOR = "a";

const DEFAULT_LINK_SELECTOR = "a[href]";
const DEFAULT_LINK_EXTRACT = "href";

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
  linkOpts: LinkOpts;

  constructor() {
    this.behaviors = [];
    this.loadedBehaviors = siteBehaviors.reduce((behaviors, next) => {
      behaviors[next.id] = next;
      return behaviors;
    }, {});
    this.mainBehavior = null;
    this.inited = false;
    this.started = false;
    this.linkOpts = {selector: DEFAULT_LINK_SELECTOR, extractName: DEFAULT_LINK_EXTRACT};
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

    if (opts.autoclick) {
      behaviorLog("Using AutoClick");
      this.behaviors.push(new AutoClick(opts.clickSelector || DEFAULT_CLICK_SELECTOR));
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
            behaviorLog({msg: e.toString(), siteSpecific: true}, "error");
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
    if (typeof(behaviorClass.id) !== "string") {
      behaviorLog("Behavior class must have a string string \"id\" property", "error");
      return;
    }

    const name = behaviorClass.id;

    if (typeof(behaviorClass) !== "function") {
      behaviorLog(`Must pass a class object, got ${behaviorClass}`, "error");
      return;
    }

    if (
      typeof(behaviorClass.isMatch) !== "function" ||
      typeof(behaviorClass.init) !== "function"
    ) {
      behaviorLog("Behavior class must have an is `isMatch()` and `init()` static methods", "error");
      return;
    }

    if (!this.isInTopFrame()) {
      if (!behaviorClass.runInIframe) {
        behaviorLog(`Behavior class ${name}: not running in iframes (.runInIframe not set)`, "debug");
        return;
      }
    }

    behaviorLog(`Behavior class ${name}: loaded`, "debug");
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
      behaviorLog("Waiting for custom page load via behavior");
      await this.mainBehavior.awaitPageLoad({Lib});
    } else {
      behaviorLog("No custom wait behavior");
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
      const id = x.id || x.constructor.id || "(Unnamed)";
      behaviorLog("Starting behavior: " + id, "debug");
      x.start();
    });

    this.started = true;

    await sleep(500);

    const allBehaviors = Promise.allSettled(this.behaviors.map(x => x.done()));

    if (this.timeout) {
      behaviorLog(`Waiting for behaviors to finish or ${this.timeout}ms timeout`, "debug");
      await Promise.race([allBehaviors, sleep(this.timeout)]);
    } else {
      behaviorLog("Waiting for behaviors to finish", "debug");
      await allBehaviors;
    }

    behaviorLog("All Behaviors Done for " + self.location.href, "debug");

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

  async extractLinks(selector = DEFAULT_LINK_SELECTOR, extractName = "href", attrOnly = false) {
    this.linkOpts = {selector, extractName, attrOnly};
    checkToJsonOverride();
    return await this.extractLinksActual();
  }

  async extractLinksActual() {
    const {selector = DEFAULT_LINK_SELECTOR, extractName = DEFAULT_LINK_EXTRACT, attrOnly = false} = this.linkOpts;

    const urls = new Set<string>();

    document.querySelectorAll(selector).forEach((elem: any) => {
      // first, try property, unless attrOnly is set
      let value = !attrOnly ? elem[extractName] : null;
      if (!value) {
        value = elem.getAttribute(extractName);
      }
      // set if got a string
      if (typeof(value) === "string") {
        urls.add(value);
      }
    });

    const promises = [];

    for (const url of urls) {
      promises.push(addLink(url));
    }

    await Promise.allSettled(promises);
  }
}


_setBehaviorManager(BehaviorManager);

installBehaviors(self);
