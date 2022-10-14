import { Behavior } from "../lib/behavior";
import { iterChildMatches, scrollAndClick, waitUntilNode, xpathNode } from "../lib/utils";

const Q = {
  commentListContainer: "//div[contains(@class, 'CommentListContainer')]",
  commentItemContainer: "div[contains(@class, 'CommentItemContainer')]",
  viewMoreReplies:      ".//p[contains(@class, 'ReplyActionText')]",
  viewMoreThread:       ".//p[starts-with(@data-e2e, 'view-more')]"
};

export const BREADTH_ALL = Symbol("BREADTH_ALL");

export class TikTokVideoBehavior extends Behavior {
  static get name() {
    return "TikTokVideo";
  }

  static isMatch() {
    const pathRegex = /https:\/\/(www\.)?tiktok\.com\/@.+\/video\/\d+/;
    return window.location.href.match(pathRegex);
  }

  constructor({ breadth = BREADTH_ALL }) {
    super();
    this.setOpts({ breadth });
  }

  shouldExitCrawlThread(next, iter) {
    const breadth = this.getOpt("breadth");
    const exhausted = breadth !== BREADTH_ALL && breadth <= iter;
    return exhausted || next === null || next.innerText === "";
  }

  async* crawlThread(parentNode, prev = null, iter = 0) {
    const next = await waitUntilNode(Q.viewMoreThread, parentNode, prev);
    if (this.shouldExitCrawlThread(next, iter)) return;
    await scrollAndClick(next, 500);
    yield this.getState("View more replies", "replies");
    yield* this.crawlThread(parentNode, next, iter + 1);
  }

  async* expandThread(item) {
    const viewMore = xpathNode(Q.viewMoreReplies, item);
    if (!viewMore) return;
    await scrollAndClick(viewMore, 500);
    yield this.getState("Expand thread", "expandedThreads");
    yield* this.crawlThread(item, null, 1);
  }

  async* [Symbol.asyncIterator]() {
    const breadth = this.getOpt("breadth");
    const commentList = xpathNode(Q.commentListContainer);
    const commentItems = iterChildMatches(Q.commentItemContainer, commentList);
    for await (const item of commentItems) {
      item.scrollIntoView(this.scrollOpts);
      yield this.getState("View thread", "threads");
      if (breadth === BREADTH_ALL || breadth > 0) {
        yield* this.expandThread(item);
      }
    }
    yield "TikTok Video Behavior Complete";
  }
}
