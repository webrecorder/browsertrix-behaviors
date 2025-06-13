const Q = {
  commentList: "//div[contains(@class, 'CommentListContainer')]",
  commentItem: "div[contains(@class, 'CommentItemContainer')]",
  viewMoreReplies: ".//p[contains(@class, 'ReplyActionText')]",
  viewMoreThread: ".//p[starts-with(@data-e2e, 'view-more') and string-length(text()) > 0]",
  profileVideoList: "//div[starts-with(@data-e2e, 'user-post-item-list')]",
  profileVideoItem: "div[contains(@class, 'DivItemContainerV2')]",
  backButton: "button[contains(@class, 'StyledCloseIconContainer')]",

  pageLoadWaitUntil: "//*[@role='dialog']"
};

export const BREADTH_ALL = Symbol("BREADTH_ALL");

export class TikTokSharedBehavior {
  async awaitPageLoad(ctx: any) {
    const { assertContentValid, waitUntilNode } = ctx.Lib;
    await waitUntilNode(Q.pageLoadWaitUntil, document, null, 10000);

    assertContentValid(() => !!document.querySelector("*[aria-label='Messages']"), "not_logged_in");
  }
}

export class TikTokVideoBehavior extends TikTokSharedBehavior {
  static id = "TikTokVideo";

  static init() {
    return {
      state: { comments: 0 },
      opts: { breadth: BREADTH_ALL }
    };
  }

  static isMatch() {
    const pathRegex = /https:\/\/(www\.)?tiktok\.com\/@.+\/video\/\d+\/?.*/;
    return !!window.location.href.match(pathRegex);
  }

  breadthComplete({ opts: { breadth } }, iter) {
    return breadth !== BREADTH_ALL && breadth <= iter;
  }

  async* crawlThread(ctx, parentNode, prev = null, iter = 0) {
    const { waitUntilNode, scrollAndClick, getState } = ctx.Lib;
    const next = await waitUntilNode(Q.viewMoreThread, parentNode, prev);
    if (!next || this.breadthComplete(ctx, iter)) return;
    await scrollAndClick(next, 500);
    yield getState(ctx, "View more replies", "comments");
    yield* this.crawlThread(ctx, parentNode, next, iter + 1);
  }

  async* expandThread(ctx, item) {
    const { xpathNode, scrollAndClick, getState } = ctx.Lib;
    const viewMore = xpathNode(Q.viewMoreReplies, item);
    if (!viewMore) return;
    await scrollAndClick(viewMore, 500);
    yield getState(ctx, "View comment", "comments");
    yield* this.crawlThread(ctx, item, null, 1);
  }

  async* run(ctx) {
    const { xpathNode, iterChildMatches, scrollIntoView, getState } = ctx.Lib;
    const commentList = xpathNode(Q.commentList);
    const commentItems = iterChildMatches(Q.commentItem, commentList);
    for await (const item of commentItems) {
      scrollIntoView(item);
      yield getState(ctx, "View comment", "comments");
      if (this.breadthComplete(ctx, 0)) continue;
      yield* this.expandThread(ctx, item);
    }
    yield getState(ctx, "TikTok Video Behavior Complete");
  }
}



export class TikTokProfileBehavior extends TikTokSharedBehavior {
  static id = "TikTokProfile";

  static isMatch() {
    const pathRegex = /https:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9]+(\/?$|\/\?.*)/;
    return !!window.location.href.match(pathRegex);
  }

  static init() {
    return {
      state: { videos: 0, comments: 0 },
      opts: { breadth: BREADTH_ALL }
    };
  }

  async* openVideo(ctx, item) {
    const { HistoryState, xpathNode, sleep } = ctx.Lib;
    const link = xpathNode(".//a", item);
    if (!link) return;
    const viewState = new HistoryState(() => link.click());
    await sleep(500);
    if (viewState.changed) {
      const videoBehavior = new TikTokVideoBehavior();
      yield* videoBehavior.run(ctx);
      await sleep(500);
      await viewState.goBack(Q.backButton);
    }
  }

  async* run(ctx) {
    const { xpathNode, iterChildMatches, scrollIntoView, getState, sleep } = ctx.Lib;
    const profileVideoList = xpathNode(Q.profileVideoList);
    const profileVideos = iterChildMatches(Q.profileVideoItem, profileVideoList);
    for await (const item of profileVideos) {
      scrollIntoView(item);
      yield getState(ctx, "View video", "videos");
      yield* this.openVideo(ctx, item);
      await sleep(500);
    }
    yield getState(ctx, "TikTok Profile Behavior Complete");
  }
}
