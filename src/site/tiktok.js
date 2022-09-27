import { Behavior } from "../lib/behavior";
import { sleep, xpathNode, xpathString, RestoreState,
  waitUntil, waitUntilNode, xpathNodes, iterChildElem } from "../lib/utils";

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



/** NOTES:
 *  - General docs for now, API docs later
 *  - Markdown preferred
 *  - 
 */


const Q = {
  commentListContainer: "//div[contains(@class, 'CommentListContainer')]",
  commentItemContainer: "//div[contains(@class, 'CommentItemContainer')]",
  viewMoreReplies:      ".//p[contains(@class, 'ReplyActionText')]",
  repliesLoading:       ".//p[contains(@class, 'ReplyActionContainer')/svg]",
  replyActionContainer: ".//div[contains(@class, 'ReplyActionContainer')]",
  viewMoreThread:       ".//p[starts-with(@data-e2e, 'view-more')]"
}


export class TikTokVideoBehavior extends Behavior {
  static isMatch() {
    const pathRe = /https:\/\/(www\.)?tiktok\.com\/@.+\/video\/\d+/;
    return window.location.href.match(pathRe);
  }

  static get name() {
    return "TikTok";
  }

  constructor() {
    super();
    this.state = { threads: 0, replies: 0 };
  }

  async scrollAndClick(node) {
    node.scrollIntoView(this.scrollOpts);
    await sleep(500);
    node.click();
  }

  async crawlThread(parentNode, prev = null) {
    const next = await waitUntilNode(Q.viewMoreThread, prev, parentNode);
    if (next === null || next.innerText === "") return;
    this.state.replies++;
    next.scrollIntoView(this.scrollOpts);
    await sleep(500);
    next.click();
    return await this.crawlThread(parentNode, next);
  }

  async* [Symbol.asyncIterator]() {
    const listNode = xpathNode(Q.commentListContainer);
    for await (const item of iterChildElem(listNode, 1000, 10000)) {
      this.state.threads++;
      item.scrollIntoView(this.scrollOpts);
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

