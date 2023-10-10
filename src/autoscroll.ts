import { Behavior } from "./lib/behavior";
import {sleep, waitUnit, xpathNode, waitUntil, scrollAndClick} from "./lib/utils";
import { type AutoFetcher } from "./autofetcher";

const Q = {
  byTextEn: "//button[contains(text(), 'more') or contains(text(), 'Show more') or contains(text(), 'More') or contains(text(), 'show more') ]",
  byTextDe: "//button[contains(text(), 'Weiter') or contains(text(), 'Mehr') or contains(text(), 'Lade') or contains(text(), 'mehr') ]",
  byId: "//button[@id=\"load-more\" or @id=\"load_more\" ]",
  byClass: "//button[@class=\"load-more\" or @class=\"load_more\" ]",
  bySpanText: "//span[contains(text(), 'Weiterlesen') or contains(text(), 'Lesen') or contains(text(), 'lesen')]",
  bySpanClass: "//span[@class=\"inline-comment-marker\"]",
  inIFramebyType: "//iframe/preceding-sibling::button",
  byType: "//button",
};
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

    return (self.window.scrollY + self["scrollHeight"]) / self.document.scrollingElement.scrollHeight >= 0.90;
  }

  haveButtons() {
    for (var key in Q) {
      let selector = Q[key];
      const showMoreElem = xpathNode( selector );
      if (showMoreElem) {
        return key;
      }
      else {
        console.log(selector + " and key " + key + " was not found in page");
      }
    }
    return false;
  }

  async* [Symbol.asyncIterator]() {
    var selector = null;
    var buttons_away = null;

    if (this.shouldScrollUp()) {
      while (!buttons_away) {
        yield* this.scrollUp();
        selector = await this.haveButtons();
        if (selector) {
          buttons_away = yield* this.clickButtons(Q[selector], true);
        }
      }
    }

    if (await this.shouldScroll()) {
      while (!buttons_away) {
        yield* this.scrollDown();
        selector = await this.haveButtons();
        if (selector) {
          buttons_away = yield* this.clickButtons(Q[selector], false);
        }
      }
    }
    if (buttons_away === null) {
      return;
    }

    yield this.getState("Skipping autoscroll, page seems to not be responsive to scrolling events");
  }

  async* clickButtons(showMoreQuery , scrollUp) {
    const lastScrollHeight = self.document.scrollingElement.scrollHeight;

    let showMoreElem = null;
    let ignoreShowMoreElem = false;

    while(!ignoreShowMoreElem)
    {
      yield this.getState("Show More + " + showMoreElem);
      console.log(showMoreQuery);

      showMoreElem = xpathNode(showMoreQuery);

      if (showMoreElem) {
        yield this.getState("Clicking 'Show More', awaiting more content");
        await scrollAndClick(showMoreElem);
        await sleep(waitUnit);

        if  (scrollUp ) {
          await Promise.race([
            waitUntil(() => self.document.scrollingElement.scrollHeight < lastScrollHeight , 500),
            sleep(30000)
          ]);
        }
        else {
          await Promise.race([
            waitUntil(() => self.document.scrollingElement.scrollHeight > lastScrollHeight
              , 500),
            sleep(30000)
          ]);
        }

        await sleep(waitUnit);
        if (self.document.scrollingElement.scrollHeight === lastScrollHeight) {
          ignoreShowMoreElem = true;
        }
        showMoreElem = null;
      }
      else
      {
        return false;
      }
    }
    return true;
  }

  async* scrollDown() {
    const scrollInc = Math.min(self.document.scrollingElement.clientHeight * 0.10, 30);
    const interval = 75;
    let elapsedWait = 0;

    const scrollOpts = { top: scrollInc, left: 0, behavior: "auto" };
    let lastScrollHeight = self.document.scrollingElement.scrollHeight;

    while (this.canScrollMore()) {
      const scrollHeight = self.document.scrollingElement.scrollHeight;

      if (scrollHeight > lastScrollHeight) {
        this.state.segments++;
        lastScrollHeight = scrollHeight;
      }

      await sleep(waitUnit);

      await Promise.race([ waitUntil(() => self.document.scrollingElement.scrollHeight > scrollHeight, 500), sleep(30000) ]);


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
    const interval = 5;

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
