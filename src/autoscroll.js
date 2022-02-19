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
      self.document.scrollingElement.clientHeight,
      self.document.scrollingElement.scrollHeight,
      self.document.scrollingElement.offsetHeight
    );
  }

  async* [Symbol.asyncIterator]() {
    const scrollInc = Math.min(self.document.scrollingElement.clientHeight * 0.05, 30);
    const interval = 75;

    let lastScrollHeight = self.document.scrollingElement.scrollHeight;

    const scrollOpts = { top: 0, left: 0, behavior: "auto" };

    scrollOpts.top = document.scrollingElement.scrollHeight - self.innerHeight;

    // check if scrolling should be done
    window.scrollTo(scrollOpts);

    if (lastScrollHeight === self.document.scrollingElement.scrollHeight) {
      yield this.getState("Skipping autoscroll, page seems to not be responsive to scrolling events");
      return;
    }

    scrollOpts.top = 0;
    window.scrollTo(scrollOpts);

    let showMoreElem = null;

    scrollOpts.top = scrollInc;

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
}
