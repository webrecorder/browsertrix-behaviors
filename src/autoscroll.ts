import { Behavior } from "./lib/behavior";
import { sleep, waitUnit, xpathNode, isInViewport, waitUntil } from "./lib/utils";
import { type AutoFetcher } from "./autofetcher";


// ===========================================================================
export class AutoScroll extends Behavior {
  autoFetcher: AutoFetcher;
  showMoreQuery: string;
  state: { segments: number };
  lastScrollPos: number;
  samePosCount: number;

  constructor(autofetcher: AutoFetcher) {
    super();

    this.autoFetcher = autofetcher;

    this.showMoreQuery = "//*[contains(text(), 'show more') or contains(text(), 'Show more')]";

    this.state = {
      segments: 1
    };

    this.lastScrollPos = -1;
    this.samePosCount = 0;
  }

  static id = "Autoscroll";

  currScrollPos() {
    return Math.round(self.scrollY + self.innerHeight);
  }

  canScrollMore() {
    const scrollElem = self.document.scrollingElement || self.document.body;
    return this.currScrollPos() < Math.max(scrollElem.clientHeight, scrollElem.scrollHeight);
  }

  hasScrollEL(obj) {
    try {
      return !!self["getEventListeners"](obj).scroll;
    } catch (e) {
      // unknown, assume has listeners
      this.debug("getEventListeners() not available");
      return true;
    }
  }

  async shouldScroll() {
    if (!this.hasScrollEL(self.window) &&
      !this.hasScrollEL(self.document) &&
      !this.hasScrollEL(self.document.body)) {
      return false;
    }

    const lastScrollHeight = self.document.scrollingElement.scrollHeight;
    const numFetching = this.autoFetcher.numFetching;

    // scroll to almost end of page
    const scrollEnd = (document.scrollingElement.scrollHeight * 0.98) - self.innerHeight;

    window.scrollTo({ top: scrollEnd, left: 0, behavior: "auto" });

    // wait for any updates
    await sleep(500);

    // scroll height changed, should scroll
    if (lastScrollHeight !== self.document.scrollingElement.scrollHeight ||
      numFetching < this.autoFetcher.numFetching) {
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

  async*[Symbol.asyncIterator]() {
    if (this.shouldScrollUp()) {
      yield* this.scrollUp();
      return;
    }

    if (await this.shouldScroll()) {
      yield* this.scrollDown();
      return;
    }

    yield this.getState("Skipping autoscroll, page seems to not be responsive to scrolling events");
  }

  async* scrollDown() {
    const scrollInc = Math.min(self.document.scrollingElement.clientHeight * 0.10, 30);
    const interval = 75;
    let elapsedWait = 0;

    let showMoreElem = null;
    let ignoreShowMoreElem = false;

    const scrollOpts = { top: scrollInc, left: 0, behavior: "auto" };
    let lastScrollHeight = self.document.scrollingElement.scrollHeight;

    while (this.canScrollMore()) {
      const scrollHeight = self.document.scrollingElement.scrollHeight;

      if (scrollHeight > lastScrollHeight) {
        this.state.segments++;
        lastScrollHeight = scrollHeight;
      }

      if (!showMoreElem && !ignoreShowMoreElem) {
        showMoreElem = xpathNode(this.showMoreQuery);
      }

      if (showMoreElem && isInViewport(showMoreElem)) {
        yield this.getState("Clicking 'Show More', awaiting more content");
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

      // eslint-disable-next-line
      self.scrollBy(scrollOpts as ScrollToOptions);

      await sleep(interval);

      if (this.state.segments === 1) {
        // only print this the first time
        yield this.getState(`Scrolling down by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`);
        elapsedWait = 2.0;

      } else {
        const waitSecs = elapsedWait / (this.state.segments - 1);
        // only add extra wait if actually changed height
        // check for scrolling, but allow for more time for content to appear the longer have already scrolled
        this.debug(`Waiting up to ${waitSecs} seconds for more scroll segments`);

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

  async* scrollUp() {
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

      // eslint-disable-next-line
      self.scrollBy(scrollOpts as ScrollToOptions);

      await sleep(interval);

      if (this.state.segments === 1) {
        // only print this the first time
        yield this.getState(`Scrolling up by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`);
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