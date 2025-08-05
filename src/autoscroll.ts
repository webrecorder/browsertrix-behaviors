import { sleep, waitUnit, xpathNode, isInViewport, waitUntil, behaviorLog, addLink, currentlyFetching } from "./lib/utils";
//import { type AutoFetcher } from "./autofetcher";


// ===========================================================================
export class AutoScroll {
  showMoreQuery: string;
  state: { segments: number } = { segments: 1};
  lastScrollPos: number;
  samePosCount: number;

  origPath: string;
  lastMsg = "";

  constructor() {
    //super();

    this.showMoreQuery = "//*[contains(text(), 'show more') or contains(text(), 'Show more')]";

    this.lastScrollPos = -1;
    this.samePosCount = 0;

    this.origPath = document.location.pathname;
  }

  static id = "Autoscroll";

  static init() {
    return {
      state: {}
    };
  }

  static isMatch() {
    return true;
  }

  async awaitPageLoad(_: any) {
    return;
  }

  currScrollPos() {
    return Math.round(self.scrollY + self.innerHeight);
  }

  canScrollMore() {
    const scrollElem = self.document.scrollingElement || self.document.body;
    return this.currScrollPos() < Math.max(scrollElem.clientHeight, scrollElem.scrollHeight);
  }

  debug(msg: string) {
    if (this.lastMsg === msg) {
      return;
    }
    super.debug(msg);
    this.lastMsg = msg;
  }

  hasScrollEL(obj) {
    try {
      return !!self["getEventListeners"](obj).scroll;
    } catch (_) {
      // unknown, assume has listeners
      void behaviorLog("getEventListeners() not available", "debug");
      return true;
    }
  }

  async shouldScroll() {
    if (!this.hasScrollEL(self.window) &&
      !this.hasScrollEL(self.document) &&
      !this.hasScrollEL(self.document.body)) {
      return false;
    }

    // if page has iframes, do scroll
    if (window.frames.length >= 2) {
      return true;
    }

    const lastScrollHeight = self.document.scrollingElement.scrollHeight;
    const numFetching = currentlyFetching();

    // scroll to almost end of page
    const scrollEnd = (document.scrollingElement.scrollHeight * 0.98) - self.innerHeight;

    window.scrollTo({ top: scrollEnd, left: 0, behavior: "smooth" });

    // wait for any updates
    await sleep(500);

    // scroll height changed, should scroll
    if (lastScrollHeight !== self.document.scrollingElement.scrollHeight ||
      numFetching < currentlyFetching()) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return true;
    }

    return false;
  }

  shouldScrollUp() {
    if (self.window.scrollY === 0) {
      return false;
    }

    if ((self.window.scrollY + self["scrollHeight"]) / self.document.scrollingElement.scrollHeight < 0.90) {
      return false;
    }

    return true;
  }

  async* run(ctx) {
    const { getState } = ctx.Lib;

    if (this.shouldScrollUp()) {
      yield* this.scrollUp(ctx);
      return;
    }

    if (await this.shouldScroll()) {
      yield* this.scrollDown(ctx);
      return;
    }

    yield getState(ctx, "Skipping autoscroll, page seems to not be responsive to scrolling events");
  }

  async* scrollDown(ctx) {
    const { getState } = ctx.Lib;
    const scrollInc = Math.min(self.document.scrollingElement.clientHeight * 0.10, 30);
    const interval = 75;
    let elapsedWait = 0;

    let showMoreElem = null;
    let ignoreShowMoreElem = false;

    const scrollOpts = { top: scrollInc, left: 0, behavior: "auto" };
    let lastScrollHeight = self.document.scrollingElement.scrollHeight;

    while (this.canScrollMore()) {
      if (document.location.pathname !== this.origPath) {
        void behaviorLog("Location Changed, stopping scroll: " +
          `${document.location.pathname} != ${this.origPath}`, "info");
        void addLink(document.location.href);
        return;
      }

      const scrollHeight = self.document.scrollingElement.scrollHeight;

      if (scrollHeight > lastScrollHeight) {
        this.state.segments++;
        lastScrollHeight = scrollHeight;
      }

      if (!showMoreElem && !ignoreShowMoreElem) {
        showMoreElem = xpathNode(this.showMoreQuery);
      }

      if (showMoreElem && isInViewport(showMoreElem)) {
        yield getState(ctx, "Clicking 'Show More', awaiting more content");
        showMoreElem["click"]();

        await sleep(waitUnit);

        await Promise.race([
          waitUntil(() => self.document.scrollingElement.scrollHeight > scrollHeight, 500),
          sleep(30000)
        ]);

        if (self.document.scrollingElement.scrollHeight === scrollHeight) {
          ignoreShowMoreElem = true;
        }

        showMoreElem = null;
      }

      self.scrollBy(scrollOpts as ScrollToOptions);

      await sleep(interval);

      if (this.state.segments === 1) {
        // only print this the first time
        yield getState(ctx, `Scrolling down by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`);
        elapsedWait = 2.0;

      } else {
        const waitSecs = elapsedWait / (this.state.segments - 1);
        // only add extra wait if actually changed height
        // check for scrolling, but allow for more time for content to appear the longer have already scrolled
        void behaviorLog(`Waiting up to ${waitSecs} seconds for more scroll segments`, "debug");

        const startTime = Date.now();

        await Promise.race([
          waitUntil(() => this.canScrollMore(), interval),
          sleep(waitSecs)
        ]);

        elapsedWait += (Date.now() - startTime) * 2;
      }

      const currPos = this.currScrollPos();

      if (currPos === this.lastScrollPos) {
        if (++this.samePosCount >= 2) {
          break;
        }
      } else {
        this.samePosCount = 0;
      }

      this.lastScrollPos = currPos;
    }
  }

  async* scrollUp(ctx) {
    const { getState } = ctx.Lib;
    const scrollInc = Math.min(self.document.scrollingElement.clientHeight * 0.10, 30);
    const interval = 75;

    const scrollOpts = { top: -scrollInc, left: 0, behavior: "auto" };

    let lastScrollHeight = self.document.scrollingElement.scrollHeight;

    while (self.scrollY > 0) {
      const scrollHeight = self.document.scrollingElement.scrollHeight;

      if (scrollHeight > lastScrollHeight) {
        this.state.segments++;
        lastScrollHeight = scrollHeight;
      }

      self.scrollBy(scrollOpts as ScrollToOptions);

      await sleep(interval);

      if (this.state.segments === 1) {
        // only print this the first time
        yield getState(ctx, `Scrolling up by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`);
      } else {
        // only add extra wait if actually changed height
        // check for scrolling, but allow for more time for content to appear the longer have already scrolled
        await Promise.race([
          waitUntil(() => self.scrollY > 0, interval),
          sleep((this.state.segments - 1) * 2000)
        ]);
      }
    }
  }
}
