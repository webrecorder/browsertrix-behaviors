import { Behavior } from "./lib/behavior";
import { sleep, waitUnit, xpathNode, isInViewport, waitUntil } from "./lib/utils";


// ===========================================================================
export class AutoScroll extends Behavior
{
  constructor(autofetcher) {
    super();

    this.autofetcher = autofetcher;

    this.showMoreQuery = "//*[contains(text(), 'show more') or contains(text(), 'Show more')]";
  
    this.state = {
      segments: 1
    };
  }

  static get name() {
    return "Autoscroll";
  }

  canScrollMore() {
    return Math.round(self.scrollY + self.innerHeight) <
    Math.max(
      self.document.body.scrollHeight,
      self.document.body.offsetHeight,
      self.document.scrollingElement.clientHeight,
      self.document.scrollingElement.scrollHeight,
      self.document.scrollingElement.offsetHeight
    );
  }

  hasScrollEL(obj) {
    try {
      return !!self.getEventListeners(obj).scroll;
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
    const numFetching = this.autofetcher.numFetching;

    // scroll to almost end of page
    const scrollEnd = (document.scrollingElement.scrollHeight * 0.98) - self.innerHeight;

    window.scrollTo({ top: scrollEnd, left: 0, behavior: "auto" });

    // wait for any updates
    await sleep(500);

    // scroll height changed, should scroll
    if (lastScrollHeight !== self.document.scrollingElement.scrollHeight ||
        numFetching < this.autofetcher.numFetching) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return true;
    }

    return false;
  }

  shouldScrollUp() {
    if (self.window.scrollY === 0) {
      return false;
    }

    if ((self.window.scrollY + self.scrollHeight) / self.document.scrollingElement.scrollHeight < 0.90) {
      return false;
    }

    return true;
  }

  async* [Symbol.asyncIterator]() {
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
    const scrollInc = Math.min(self.document.scrollingElement.clientHeight * 0.05, 30);
    const interval = 75;

    let showMoreElem = null;

    const scrollOpts = { top: scrollInc, left: 0, behavior: "auto" };
    let lastScrollHeight = self.document.scrollingElement.scrollHeight;

    while (this.canScrollMore()) {
      const scrollHeight = self.document.scrollingElement.scrollHeight;

      if (scrollHeight > lastScrollHeight) {
        this.state.segments++;
        lastScrollHeight = scrollHeight;
      }

      if (!showMoreElem) {
        showMoreElem = xpathNode(this.showMoreQuery);
      }

      if (showMoreElem && isInViewport(showMoreElem)) {
        yield this.getState("Clicking 'Show More', awaiting more content");
        showMoreElem.click();

        await sleep(waitUnit);

        await Promise.race([
          waitUntil(() => self.document.scrollingElement.scrollHeight > scrollHeight, 500),
          sleep(30000)
        ]);

        showMoreElem = null;
      }

      self.scrollBy(scrollOpts);

      await sleep(interval);

      if (this.state.segments === 1) {
        // only print this the first time
        yield this.getState(`Scrolling down by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`);
      } else {
        // only add extra wait if actually changed height
        // check for scrolling, but allow for more time for content to appear the longer have already scrolled
        await Promise.race([
          waitUntil(() => this.canScrollMore(), interval),
          sleep((this.state.segments - 1) * 2000)
        ]);
      }
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

      self.scrollBy(scrollOpts);

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
