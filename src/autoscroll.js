import { sleep, Behavior, waitUnit } from "./lib/utils";


// ===========================================================================
export class AutoScroll extends Behavior
{
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

    while (canScrollMore()) {
      const interval = waitUnit * 2.5;
      self.scrollBy(scrollOpts);
      yield {"msg": `Scrolling down by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`};
      await sleep(interval);
    }
  }
}
