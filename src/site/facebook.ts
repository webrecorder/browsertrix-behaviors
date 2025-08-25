import { type Context } from "../lib/behavior";

const Q = {
  feed: "//div[@role='feed']",
  article: ".//div[@role='article']",
  pageletPostList:
    "//div[@data-pagelet='page']/div[@role='main']//div[@role='main']/div",
  pageletProfilePostList:
    "//div[@data-pagelet='page']//div[@data-pagelet='ProfileTimeline']",
  articleToPostList: "//div[@role='article']/../../../../div",
  photosOrVideos: `.//a[(contains(@href, '/photos/') or contains(@href, '/photo/?') or contains(@href, '/videos/')) and (starts-with(@href, '${window.location.origin}/') or starts-with(@href, '/'))]`,
  postQuery: ".//a[contains(@href, '/posts/')]",
  extraLabel: "//*[starts-with(text(), '+')]",
  nextSlideQuery:
    "//div[@data-name='media-viewer-nav-container']/div[@data-visualcompletion][2]//div[@role='button']",
  nextSlide:
    "//div[@aria-hidden='false']//div[@role='button' and not(@aria-hidden) and @aria-label]",
  commentList: ".//ul[(../h3) or (../h4)]",
  commentMoreReplies: "./div[2]/div[1]/div[2]/div[@role='button']",
  commentMoreComments:
    "./following-sibling::div/div/div[2][@role='button'][./span/span]",
  viewComments: ".//h4/..//div[@role='button']",
  photoCommentList: "//ul[../h2]",
  firstPhotoThumbnail:
    "//div[@role='main']//div[3]//div[contains(@style, 'border-radius')]//div[contains(@style, 'max-width') and contains(@style, 'min-width')]//a[@role='link']",
  firstVideoThumbnail:
    "//div[@role='main']//div[contains(@style, 'z-index')]/following-sibling::div/div/div/div[last()]//a[contains(@href, '/videos/') and @aria-hidden!='true']",
  firstVideoSimple:
    "//div[@role='main']//a[contains(@href, '/videos/') and @aria-hidden!='true']",
  mainVideo:
    "//div[@data-pagelet='root']//div[@role='dialog']//div[@role='main']//video",
  nextVideo:
    "following::a[contains(@href, '/videos/') and @aria-hidden!='true']",
  isPhotoVideoPage: /^.*facebook\.com\/[^/]+\/(photos|videos)\/.+/,
  isPhotosPage: /^.*facebook\.com\/[^/]+\/photos\/?($|\?)/,
  isVideosPage: /^.*facebook\.com\/[^/]+\/videos\/?($|\?)/,
  pageLoadWaitUntil: "//div[@role='main']",
};

type FacebookState = Partial<{
  photos: number;
  videos: number;
  comments: number;
  posts: number;
}>;

export class FacebookTimelineBehavior {
  extraWindow: WindowProxy | null;
  allowNewWindow: boolean;

  static id = "Facebook";

  static isMatch() {
    // match just for posts for now
    return !!window.location.href.match(
      /https:\/\/(www\.)?facebook\.com\/.*\/posts\//,
    );
  }

  static init() {
    return {
      state: {},
    };
  }

  constructor() {
    this.extraWindow = null;
    //todo: make option
    this.allowNewWindow = false;
  }

  async *iterPostFeeds(ctx: Context<FacebookState, unknown>) {
    const { iterChildElem, waitUnit, waitUntil, xpathNode, xpathNodes } =
      ctx.Lib;
    const feeds = Array.from(xpathNodes(Q.feed)) as Element[];
    if (feeds.length) {
      for (const feed of feeds) {
        for await (const post of iterChildElem(
          feed,
          waitUnit,
          // @ts-expect-error TODO: `waitUntil` is a function, why are we trying to multiply it by 10?
          waitUntil * 10,
        )) {
          yield* this.viewPost(
            ctx,
            xpathNode(Q.article, post) as Element | null,
          );
        }
      }
    } else {
      const feed = (xpathNode(Q.pageletPostList) ||
        xpathNode(Q.pageletProfilePostList) ||
        xpathNode(Q.articleToPostList)) as Element | null;

      if (!feed) {
        return;
      }

      for await (const post of iterChildElem(
        feed,
        waitUnit,
        // @ts-expect-error TODO: again, `waitUntil` is a function, not a number
        waitUntil * 10,
      )) {
        yield* this.viewPost(ctx, xpathNode(Q.article, post) as Element);
      }
    }

    if (this.extraWindow) {
      this.extraWindow.close();
    }
  }

  async *viewPost(
    ctx: Context<FacebookState, unknown>,
    post: Element | null,
    maxExpands = 2,
  ) {
    const { getState, scrollIntoView, sleep, waitUnit, xpathNode } = ctx.Lib;
    if (!post) {
      return;
    }

    const postLink = xpathNode(Q.postQuery, post) as HTMLAnchorElement | null;

    let url = null;

    if (postLink) {
      url = new URL(postLink.href, window.location.href);
      url.search = "";
    }

    yield getState(ctx, "Viewing post " + (url || ""), "posts");

    scrollIntoView(post);

    await sleep(waitUnit * 2);

    if (xpathNode(".//video", post)) {
      yield getState(ctx, "Playing inline video", "videos");
      await sleep(waitUnit * 2);
    }

    //yield* this.viewPhotosOrVideos(ctx, post);

    let commentRootUL = xpathNode(
      Q.commentList,
      post,
    ) as HTMLUListElement | null;
    if (!commentRootUL) {
      const viewCommentsButton = xpathNode(
        Q.viewComments,
        post,
      ) as HTMLElement | null;
      if (viewCommentsButton) {
        viewCommentsButton.click();
        await sleep(waitUnit * 2);
      }
      commentRootUL = xpathNode(Q.commentList, post) as HTMLUListElement | null;
    }
    yield* this.iterComments(ctx, commentRootUL, maxExpands);

    await sleep(waitUnit * 5);
  }

  async *viewPhotosOrVideos(
    ctx: Context<FacebookState, unknown>,
    post: Element | null,
  ) {
    const { getState, sleep, waitUnit, xpathNode, xpathNodes } = ctx.Lib;
    const objects = Array.from(
      xpathNodes(Q.photosOrVideos, post),
    ) as HTMLAnchorElement[];

    const objHrefs = new Set();
    let count = 0;

    for (const obj of objects) {
      const url = new URL(obj.href, window.location.href);
      if (obj.href.indexOf("?fbid") === -1) {
        url.search = "";
      }

      if (objHrefs.has(url.href)) {
        continue;
      }

      const type = obj.href.indexOf("/video") >= 0 ? "videos" : "photos";

      ++count;

      objHrefs.add(url.href);

      yield getState(ctx, `Viewing ${type} ${url.href}`, type);

      obj.scrollIntoView();

      await sleep(waitUnit * 5);

      obj.click();

      await sleep(waitUnit * 10);
      //await sleep(10000);

      if (this.allowNewWindow) {
        await this.openNewWindow(ctx, url.href);
      }

      if (count === objects.length) {
        yield* this.viewExtraObjects(ctx, obj, type, this.allowNewWindow);
      }

      const close = xpathNode(Q.nextSlide) as HTMLElement | null;

      if (close) {
        close.click();
        await sleep(waitUnit * 2);
      }
    }
  }

  async *viewExtraObjects(
    ctx: Context<FacebookState, unknown>,
    obj: Node | null,
    type: string,
    openNew: boolean,
  ) {
    const { getState, sleep, waitUnit, waitUntil, xpathNode } = ctx.Lib;
    const extraLabel = xpathNode(Q.extraLabel, obj) as HTMLElement | null;

    if (!extraLabel) {
      return;
    }

    const num = Number(extraLabel.innerText.slice(1));
    if (isNaN(num)) {
      return;
    }

    let lastHref: string | undefined;

    for (let i = 0; i < num; i++) {
      const nextSlideButton = xpathNode(Q.nextSlideQuery) as HTMLElement | null;

      if (!nextSlideButton) {
        continue;
      }

      lastHref = window.location.href;

      nextSlideButton.click();
      await sleep(waitUnit * 5);

      await waitUntil(() => window.location.href !== lastHref, waitUnit * 2);

      yield getState(ctx, `Viewing extra ${type} ${window.location.href}`);

      if (openNew) {
        await this.openNewWindow(ctx, window.location.href);
      }
    }
  }

  async openNewWindow(ctx: Context<FacebookState, unknown>, url: string) {
    if (!this.extraWindow) {
      this.extraWindow = await ctx.Lib.openWindow(url);
    } else {
      this.extraWindow.location.href = url;
    }
  }

  async *iterComments(
    ctx: Context<FacebookState, unknown>,
    commentRootUL: HTMLUListElement | null,
    maxExpands = 2,
  ) {
    const { getState, scrollIntoView, sleep, waitUnit, xpathNode } = ctx.Lib;
    if (!commentRootUL) {
      await sleep(waitUnit * 5);
      return;
    }
    let commentBlock = commentRootUL.firstElementChild;
    let lastBlock = null;

    let count = 0;

    while (commentBlock && count < maxExpands) {
      while (commentBlock && count < maxExpands) {
        yield getState(ctx, "Loading comments", "comments");
        scrollIntoView(commentBlock);
        await sleep(waitUnit * 2);

        const moreReplies = xpathNode(
          Q.commentMoreReplies,
          commentBlock,
        ) as HTMLElement | null;
        if (moreReplies) {
          moreReplies.click();
          await sleep(waitUnit * 5);
        }

        lastBlock = commentBlock;
        commentBlock = lastBlock.nextElementSibling;
        count++;
      }

      if (count === maxExpands) {
        break;
      }

      const moreButton = xpathNode(
        Q.commentMoreComments,
        commentRootUL,
      ) as HTMLElement | null;
      if (moreButton) {
        scrollIntoView(moreButton);
        moreButton.click();
        await sleep(waitUnit * 5);
        if (lastBlock) {
          commentBlock = lastBlock.nextElementSibling;
          await sleep(waitUnit * 5);
        }
      }
    }

    await sleep(waitUnit * 2);
  }

  async *iterPhotoSlideShow(ctx: Context<FacebookState, unknown>) {
    const { getState, scrollIntoView, sleep, waitUnit, waitUntil, xpathNode } =
      ctx.Lib;
    const firstPhoto = xpathNode(Q.firstPhotoThumbnail) as HTMLElement | null;

    if (!firstPhoto) {
      return;
    }

    let lastHref = window.location.href;

    scrollIntoView(firstPhoto);

    firstPhoto.click();
    await sleep(waitUnit * 5);
    await waitUntil(() => window.location.href !== lastHref, waitUnit * 2);

    let nextSlideButton = null;

    while (
      (nextSlideButton = xpathNode(Q.nextSlideQuery) as HTMLElement | null)
    ) {
      lastHref = window.location.href;

      await sleep(waitUnit);
      nextSlideButton.click();
      await sleep(waitUnit * 5);

      await Promise.race([
        waitUntil(() => window.location.href !== lastHref, waitUnit * 2),
        sleep(3000),
      ]);

      if (window.location.href === lastHref) {
        break;
      }

      yield getState(ctx, `Viewing photo ${window.location.href}`, "photos");

      const root = xpathNode(Q.photoCommentList) as HTMLUListElement | null;
      yield* this.iterComments(ctx, root, 2);

      await sleep(waitUnit * 5);
    }
  }

  async *iterAllVideos(ctx: Context<FacebookState, unknown>) {
    const {
      getState,
      scrollIntoView,
      sleep,
      waitUnit,
      waitUntil,
      xpathNode,
      xpathNodes,
    } = ctx.Lib;
    const firstInlineVideo = xpathNode("//video") as HTMLElement | null;
    if (firstInlineVideo) {
      scrollIntoView(firstInlineVideo);
      await sleep(waitUnit * 5);
    }

    let videoLink = (xpathNode(Q.firstVideoThumbnail) ||
      xpathNode(Q.firstVideoSimple)) as HTMLElement | null;

    if (!videoLink) {
      return;
    }

    while (videoLink) {
      scrollIntoView(videoLink);

      let lastHref = window.location.href;
      videoLink.click();
      await waitUntil(() => window.location.href !== lastHref, waitUnit * 2);

      yield getState(ctx, "Viewing video: " + window.location.href, "videos");

      await sleep(waitUnit * 10);

      // wait for video to play, or 20s
      await Promise.race([
        waitUntil(() => {
          for (const video of xpathNodes(
            "//video",
          ) as Generator<HTMLVideoElement>) {
            if (video.readyState >= 3) {
              return true;
            }
          }
          return false;
        }, waitUnit * 2),
        sleep(20000),
      ]);

      await sleep(waitUnit * 10);

      const close = xpathNode(Q.nextSlide) as HTMLElement | null;

      if (!close) {
        break;
      }

      lastHref = window.location.href;
      close.click();
      await waitUntil(() => window.location.href !== lastHref, waitUnit * 2);

      videoLink = xpathNode(Q.nextVideo, videoLink) as HTMLElement | null;
    }
  }

  async *run(ctx: Context<FacebookState, unknown>) {
    const { getState, sleep, xpathNode } = ctx.Lib;
    yield getState(ctx, "Starting...");

    await sleep(2000);

    if (Q.isPhotosPage.exec(window.location.href)) {
      ctx.state = { photos: 0, comments: 0 };
      yield* this.iterPhotoSlideShow(ctx);
      return;
    }

    if (Q.isVideosPage.exec(window.location.href)) {
      ctx.state = { videos: 0, comments: 0 };
      yield* this.iterAllVideos(ctx);
      return;
    }

    if (Q.isPhotoVideoPage.exec(window.location.href)) {
      ctx.state = { comments: 0 };
      const root = xpathNode(Q.photoCommentList) as HTMLUListElement | null;
      yield* this.iterComments(ctx, root, 1000);
      return;
    }

    ctx.state = { posts: 0, comments: 0, videos: 0 };
    yield* this.iterPostFeeds(ctx);
  }

  async awaitPageLoad(ctx: Context<FacebookState, unknown>) {
    const { Lib, log } = ctx;
    const { assertContentValid, waitUntilNode } = Lib;

    void log("Waiting for Facebook to fully load", "info");

    await waitUntilNode(Q.pageLoadWaitUntil, document, null, 10000);

    assertContentValid(
      () => !!document.querySelector("div[aria-label*='Account Controls' i]"),
      "not_logged_in",
    );
  }
}
