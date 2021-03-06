import { sleep, Behavior } from "./lib/utils";


// ===========================================================================
export class AutoScroll extends Behavior
{
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
      self.scrollBy(scrollOpts);
      yield {"msg": "Scrolling by " + scrollOpts.top};
      await sleep(500);
    }
  }
}
