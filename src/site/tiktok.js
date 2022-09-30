import { Behavior } from "../lib/behavior";
import { sleep, xpathNode, waitUntilNode, iterChildMatches } from "../lib/utils";

/**
 * Steps for building behaviors:
 *  - import 'Behavior' class from '../lib/behavior'
 *  - define new exported class that extends the 'Behavior' class
 *  - define an `isMatch` static method
 *  - define a `name` static getter method
 *  - define a constructor method that calls `super()`
 *  - [DEBUG(optional)] define a `this.state` attribute to log information
 *                      such as number of links discovered, etc.
 *  - define a `[Symbol.asyncIterator]` method. This acts as the entrypoint
 *    for the behavior
 *
 * */

/** TODO:
 *  - [x] Pass settings to __bx_behaviors.run()
 *  - [x] Settings: nested, comment depth, comment breadth
 *  - [x] Add watch command to Webpack (reference extension)
 *  - [ ] General docs for now, API docs later (markdown preferred)
 *  - [ ] Use video behavior in profile behavior
 *  - [ ] DSL propasal
*/

/** NOTES:
 *  - YouTube behavior?
 *  - Migrate to TypeScript
 *  - Build each behavior separately?
 *  - Allow people to "paste" in their compiled behaviors into the browser
 *    extension or target specific behaviors to include in the crawler build
 */

const Q = {
  commentListContainer: "//div[contains(@class, 'CommentListContainer')]",
  commentItemContainer: "./self::div[contains(@class, 'CommentItemContainer')]",
  viewMoreReplies:      ".//p[contains(@class, 'ReplyActionText')]",
  repliesLoading:       ".//p[contains(@class, 'ReplyActionContainer')/svg]",
  replyActionContainer: ".//div[contains(@class, 'ReplyActionContainer')]",
  viewMoreThread:       ".//p[starts-with(@data-e2e, 'view-more')]"
};

export const BREADTH_ALL = Symbol("BREADTH_ALL");

export class TikTokVideoBehavior extends Behavior {
  static isMatch() {
    const pathRe = /https:\/\/(www\.)?tiktok\.com\/@.+\/video\/\d+/;
    return window.location.href.match(pathRe);
  }

  static get name() {
    return "TikTokVideo";
  }

  constructor({ breadth = BREADTH_ALL }) {
    super();
    this.opts = { breadth };
    this.state = { threads: 0, replies: 0 };
    this.scrollOpts = {behavior: "smooth", block: "center", inline: "center"};
  }

  async scrollAndClick(node) {
    node.scrollIntoView(this.scrollOpts);
    await sleep(500);
    node.click();
  }

  isBreadthAll() {
    return this.opts.breadth === BREADTH_ALL;
  }

  async crawlThread(parentNode, prev = null, iter = 0) {
    if (!this.isBreadthAll() && iter > this.opts.breadth) return;
    const next = await waitUntilNode(Q.viewMoreThread, prev, parentNode);
    if (next === null || next.innerText === "") return;
    this.state.replies++;
    this.scrollAndClick(next);
    return await this.crawlThread(parentNode, next, iter + 1);
  }

  async* [Symbol.asyncIterator]() {
    const listNode = xpathNode(Q.commentListContainer);
    for await (const item of iterChildMatches(Q.commentItemContainer, listNode, 200, 10000)) {
      this.state.threads++;
      item.scrollIntoView(this.scrollOpts);
      console.log(item);
      const viewMore = xpathNode(Q.viewMoreReplies, item);
      if (viewMore) {
        await this.scrollAndClick(viewMore);
        await this.crawlThread(item);
      }
    }
    console.log(this.state);
    yield;
  }
}
