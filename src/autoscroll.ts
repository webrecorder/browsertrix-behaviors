import {
  type AbstractBehavior,
  BackgroundBehavior,
  type Context,
} from "./lib/behavior";
import {
  sleep,
  waitUnit,
  xpathNode,
  isInViewport,
  waitUntil,
  behaviorLog,
  addLink,
  getState,
} from "./lib/utils";
import { type AutoFetcher } from "./autofetcher";

type AutoScrollState = { segments: number };
type AutoScrollOpts = { autoFetcher: AutoFetcher };

export class AutoScroll
  extends BackgroundBehavior
  implements AbstractBehavior<AutoScrollState, AutoScrollOpts>
{
  showMoreQuery: string;
  lastScrollPos: number;
  samePosCount: number;
  origPath: string;
  lastMsg = "";

  constructor() {
    super();

    this.showMoreQuery =
      "//*[contains(text(), 'show more') or contains(text(), 'Show more')]";

    this.lastScrollPos = -1;
    this.samePosCount = 0;

    this.origPath = document.location.pathname;
  }

  static id = "Autoscroll";

  static isMatch() {
    return true;
  }

  static init() {
    return {
      state: { segments: 1 },
      opts: {},
    };
  }

  currScrollPos() {
    return Math.round(self.scrollY + self.innerHeight);
  }

  canScrollMore() {
    const scrollElem = self.document.scrollingElement || self.document.body;
    return (
      this.currScrollPos() <
      Math.max(scrollElem.clientHeight, scrollElem.scrollHeight)
    );
  }

  debug(msg: string) {
    if (this.lastMsg === msg) {
      return;
    }
    super.debug(msg);
    this.lastMsg = msg;
  }

  hasScrollEL(obj: HTMLElement | Document | Window) {
    try {
      return !!self["getEventListeners"]!(obj).scroll;
    } catch (_) {
      // unknown, assume has listeners
      this.debug("getEventListeners() not available");
      return true;
    }
  }

  async shouldScroll(ctx: Context<AutoScrollState, AutoScrollOpts>) {
    if (
      !this.hasScrollEL(self.window) &&
      !this.hasScrollEL(self.document) &&
      !this.hasScrollEL(self.document.body)
    ) {
      return false;
    }

    // if page has iframes, do scroll
    if (window.frames.length >= 2) {
      return true;
    }

    const lastScrollHeight = self.document.scrollingElement!.scrollHeight;
    const numFetching = ctx.opts.autoFetcher.numFetching;

    // scroll to almost end of page
    const scrollEnd =
      document.scrollingElement!.scrollHeight * 0.98 - self.innerHeight;

    window.scrollTo({ top: scrollEnd, left: 0, behavior: "smooth" });

    // wait for any updates
    await sleep(500);

    // scroll height changed, should scroll
    if (
      lastScrollHeight !== self.document.scrollingElement!.scrollHeight ||
      numFetching < ctx.opts.autoFetcher.numFetching
    ) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return true;
    }

    return false;
  }

  shouldScrollUp() {
    if (self.window.scrollY === 0) {
      return false;
    }

    if (
      (self.window.scrollY + self["scrollHeight"]) /
        self.document.scrollingElement!.scrollHeight <
      0.9
    ) {
      return false;
    }

    return true;
  }

  async *run(ctx: Context<AutoScrollState, AutoScrollOpts>) {
    if (this.shouldScrollUp()) {
      yield* this.scrollUp(ctx);
      return;
    }

    if (await this.shouldScroll(ctx)) {
      yield* this.scrollDown(ctx);
      return;
    }

    yield getState(
      ctx,
      "Skipping autoscroll, page seems to not be responsive to scrolling events",
    );
  }

  async *scrollDown(ctx: Context<AutoScrollState, AutoScrollOpts>) {
    const scrollInc = Math.min(
      self.document.scrollingElement!.clientHeight * 0.1,
      30,
    );
    const interval = 75;
    let elapsedWait = 0;

    let showMoreElem: HTMLElement | null = null;
    let ignoreShowMoreElem = false;

    const scrollOpts = { top: scrollInc, left: 0, behavior: "auto" };
    let lastScrollHeight = self.document.scrollingElement!.scrollHeight;

    while (this.canScrollMore()) {
      if (document.location.pathname !== this.origPath) {
        void behaviorLog(
          "Location Changed, stopping scroll: " +
            `${document.location.pathname} != ${this.origPath}`,
          "info",
        );
        void addLink(document.location.href);
        return;
      }

      const scrollHeight = self.document.scrollingElement!.scrollHeight;

      if (scrollHeight > lastScrollHeight) {
        ctx.state.segments++;
        lastScrollHeight = scrollHeight;
      }

      if (!showMoreElem && !ignoreShowMoreElem) {
        showMoreElem = xpathNode(this.showMoreQuery) as HTMLElement | null;
      }

      if (showMoreElem && isInViewport(showMoreElem)) {
        yield getState(ctx, "Clicking 'Show More', awaiting more content");
        showMoreElem["click"]();

        await sleep(waitUnit);

        await Promise.race([
          waitUntil(
            () => self.document.scrollingElement!.scrollHeight > scrollHeight,
            500,
          ),
          sleep(30000),
        ]);

        if (self.document.scrollingElement!.scrollHeight === scrollHeight) {
          ignoreShowMoreElem = true;
        }

        showMoreElem = null;
      }

      self.scrollBy(scrollOpts as ScrollToOptions);

      await sleep(interval);

      if (ctx.state.segments === 1) {
        // only print this the first time
        yield getState(
          ctx,
          `Scrolling down by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`,
        );
        elapsedWait = 2.0;
      } else {
        const waitSecs = elapsedWait / (ctx.state.segments - 1);
        // only add extra wait if actually changed height
        // check for scrolling, but allow for more time for content to appear the longer have already scrolled
        this.debug(
          `Waiting up to ${waitSecs} seconds for more scroll segments`,
        );

        const startTime = Date.now();

        await Promise.race([
          waitUntil(() => this.canScrollMore(), interval),
          sleep(waitSecs),
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

  async *scrollUp(ctx: Context<AutoScrollState, AutoScrollOpts>) {
    const scrollInc = Math.min(
      self.document.scrollingElement!.clientHeight * 0.1,
      30,
    );
    const interval = 75;

    const scrollOpts = { top: -scrollInc, left: 0, behavior: "auto" };

    let lastScrollHeight = self.document.scrollingElement!.scrollHeight;

    while (self.scrollY > 0) {
      const scrollHeight = self.document.scrollingElement!.scrollHeight;

      if (scrollHeight > lastScrollHeight) {
        ctx.state.segments++;
        lastScrollHeight = scrollHeight;
      }

      self.scrollBy(scrollOpts as ScrollToOptions);

      await sleep(interval);

      if (ctx.state.segments === 1) {
        // only print this the first time
        yield getState(
          ctx,
          `Scrolling up by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`,
        );
      } else {
        // only add extra wait if actually changed height
        // check for scrolling, but allow for more time for content to appear the longer have already scrolled
        await Promise.race([
          waitUntil(() => self.scrollY > 0, interval),
          sleep((ctx.state.segments - 1) * 2000),
        ]);
      }
    }
  }
}
