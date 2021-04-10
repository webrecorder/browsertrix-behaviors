import { sleep, Behavior, waitUnit, xpathNode, isInViewport, waitUntil } from "./lib/utils";


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

  async* [Symbol.asyncIterator]() {
    const canScrollMore = () =>
      self.scrollY + self.innerHeight <
      Math.max(
        self.document.body.scrollHeight,
        self.document.body.offsetHeight,
        self.document.documentElement.clientHeight,
        self.document.documentElement.scrollHeight,
        self.document.documentElement.offsetHeight
      );

    const scrollOpts = { top: 200, left: 0, behavior: "auto" };
    const interval = waitUnit;

    //scrollOpts.top = Math.min(self.document.body.clientHeight * 0.01, 500);

    let showMoreElem = null;
    let origHeight = self.document.body.clientHeight;

    while (canScrollMore()) {
      if (self.document.body.clientHeight > origHeight) {
        this.state.segments++;
      }

      origHeight = self.document.body.clientHeight;

      if (!showMoreElem) {
        showMoreElem = xpathNode(this.showMoreQuery);
      }

      if (showMoreElem && isInViewport(showMoreElem)) {
        yield this.getState("Clicking 'Show More', awaiting more content");
        showMoreElem.click();

        await sleep(waitUnit);

        await Promise.race([
          waitUntil(() => self.document.body.clientHeight > origHeight, 500),
          sleep(30000)
        ]);

        showMoreElem = null;
      }

      self.scrollBy(scrollOpts);

      yield this.getState(`Scrolling down by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`);
      
      await sleep(interval);
      
      // check for scrolling, but allow for more time for content to appear the longer have already scrolled
      await Promise.race([
        waitUntil(() => canScrollMore(), interval),
        sleep(this.state.segments * 5000)
      ]);
    }
  }
}
