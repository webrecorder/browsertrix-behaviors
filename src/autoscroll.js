import { sleep, Behavior, waitUnit, xpathNode, isInViewport } from "./lib/utils";


// ===========================================================================
export class AutoScroll extends Behavior
{
  constructor() {
    super();
    this.showMoreQuery = "//*[contains(text(), 'show more') or contains(text(), 'Show more')]";
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

    const scrollOpts = { top: 250, left: 0, behavior: "auto" };
    const interval = waitUnit;

    let showMoreElem = null;

    while (canScrollMore()) {
      if (!showMoreElem) {
        showMoreElem = xpathNode(this.showMoreQuery);
      }

      if (showMoreElem && isInViewport(showMoreElem)) {
        yield {"msg": "Click Show More"};
        showMoreElem.click();
        await sleep(waitUnit * 5);
        showMoreElem = null;
      }

      scrollOpts.top = Math.min(self.document.body.clientHeight * 0.01, 500);

      self.scrollBy(scrollOpts);

      yield {"msg": `Scrolling down by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`};
      await sleep(interval);

    }
  }
}
