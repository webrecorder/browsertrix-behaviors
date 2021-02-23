import { sleep } from "./lib/utils";


// ===========================================================================
export class AutoScroll
{
  init() {
    this.running = this.run();
  }

  async run() {
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
      await sleep(500);
    }
  }

  done() {
    return Promise.race([this.running, sleep(30000)]);
  }
}
