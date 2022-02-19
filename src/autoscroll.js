import { Behavior } from "./lib/behavior";
import { sleep, waitUnit, xpathNode, isInViewport, waitUntil } from "./lib/utils";


// ===========================================================================
export class AutoScroll extends Behavior
{
  constructor() {
    super();
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
      self.document.documentElement.clientHeight,
      self.document.documentElement.scrollHeight,
      self.document.documentElement.offsetHeight
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

  async* [Symbol.asyncIterator]() {
    const scrollInc = Math.min(self.document.body.clientHeight * 0.05, 30);
    const interval = 75;

    if (!this.hasScrollEL(self.window) &&
        !this.hasScrollEL(self.document) &&
        !this.hasScrollEL(self.document.body)) {
      yield this.getState("Skipping autoscroll, page seems to be static (no 'scroll' event listeners)");
      return;
    }

    const scrollOpts = { top: scrollInc, left: 0, behavior: "auto" };

    let showMoreElem = null;
    let lastScrollHeight = self.document.body.scrollHeight;

    while (this.canScrollMore()) {
      const scrollHeight = self.document.body.scrollHeight;

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
          waitUntil(() => self.document.body.scrollHeight > scrollHeight, 500),
          sleep(30000)
        ]);

        showMoreElem = null;
      }

      self.scrollBy(scrollOpts);

      yield this.getState(`Scrolling down by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`);
      
      await sleep(interval);

      // only add extra wait if actually changed height
      if (this.state.segments > 1) {
        // check for scrolling, but allow for more time for content to appear the longer have already scrolled
        await Promise.race([
          waitUntil(() => this.canScrollMore(), interval),
          sleep((this.state.segments - 1) * 2000)
        ]);

      }
    }
  }
}
