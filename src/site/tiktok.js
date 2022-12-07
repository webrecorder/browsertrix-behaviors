import { Behavior } from "../lib/behavior";
import { HistoryState, iterChildMatches, scrollAndClick, sleep, waitUntilNode, xpathNode } from "../lib/utils";

const Q = {
  commentList:      "//div[contains(@class, 'CommentListContainer')]",
  commentItem:      "div[contains(@class, 'CommentItemContainer')]",
  viewMoreReplies:  ".//p[contains(@class, 'ReplyActionText')]",
  viewMoreThread:   ".//p[starts-with(@data-e2e, 'view-more') and string-length(text()) > 0]",
  profileVideoList: "//div[starts-with(@data-e2e, 'user-post-item-list')]",
  profileVideoItem: "div[contains(@class, 'DivItemContainerV2')]",
  backButton:       "button[contains(@class, 'StyledCloseIconContainer')]"
};

export const BREADTH_ALL = Symbol("BREADTH_ALL");

export class TikTokVideoBehavior extends Behavior {
  static get name() {
    return "TikTokVideo";
  }

  static isMatch() {
    const pathRegex = /https:\/\/(www\.)?tiktok\.com\/@.+\/video\/\d+\/?.*/;
    return window.location.href.match(pathRegex);
  }

  constructor({ breadth = BREADTH_ALL }) {
    super();
    this.setOpts({ breadth });
  }

  breadthComplete(iter) {
    const breadth = this.getOpt("breadth");
    return breadth !== BREADTH_ALL && breadth <= iter;
  }

  async* crawlThread(parentNode, prev = null, iter = 0) {
    const next = await waitUntilNode(Q.viewMoreThread, parentNode, prev);
    if (!next || this.breadthComplete(iter)) return;
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
    const commentList = xpathNode(Q.commentList);
    const commentItems = iterChildMatches(Q.commentItem, commentList);
    for await (const item of commentItems) {
      item.scrollIntoView(this.scrollOpts);
      yield this.getState("View thread", "threads");
      if (this.breadthComplete(0)) continue;
      yield* this.expandThread(item);
    }
    yield "TikTok Video Behavior Complete";
  }
}

export class TiktokPofileBehavior extends Behavior {
  static get name() {
    return "TikTokVideo";
  }

  static isMatch() {
    const pathRegex = /https:\/\/(www\.)?tiktok\.com\/@.+\/?.*/;
    return window.location.href.match(pathRegex);
  }

  constructor({ breadth = BREADTH_ALL }) {
    super();
    this.setOpts({ breadth });
  }

  async* openVideo(item) {
    const link = xpathNode(".//a", item);
    if (!link) return;
    const viewState = new HistoryState(() => link.click());
    await sleep(500);
    if (viewState.changed) {
      const breadth = this.getOpts("breadth");
      const videoBehavior = new TikTokVideoBehavior({ breadth });
      yield* videoBehavior;
      await sleep(500);
      await viewState.goBack(Q.backButton);
    }
  }

  async* [Symbol.asyncIterator]() {
    const profileVideoList = xpathNode(Q.profileVideoList);
    const profileVideos = iterChildMatches(Q.profileVideoItem, profileVideoList);
    for await (const item of profileVideos) {
      item.scrollIntoView(this.scrollOpts);
      yield this.getState("View video", "videos");
      yield* this.openVideo(item);
      await sleep(500);
    }
    yield "TikTok Profile Behavior Complete";
  }
}
