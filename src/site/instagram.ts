import { AutoScroll } from "../autoscroll";

const subpostNextOnlyChevron = "//article[@role='presentation']//div[@role='presentation']/following-sibling::button";

const Q = {
  rootPath: "//main/div/div[2]/div",
  childMatchSelect: "string(.//a[starts-with(@href, '/')]/@href)",
  childMatch: "child::div[.//a[@href='$1']]",
  firstPostInRow: "div[1]//a",
  postCloseButton: "//div[last() - 2]//div[@role='button']",
  nextPost: "//button[.//*[local-name() = 'svg' and @aria-label='Next']]",
  postLoading: "//*[@aria-label='Loading...']",
  subpostNextOnlyChevron,
  subpostPrevNextChevron: subpostNextOnlyChevron + "[2]",
  commentRoot: "//article[@role='presentation']/div[1]/div[2]//ul/div[last()]/div/div",
  viewReplies: "ul/li//button[span[not(count(*)) and contains(text(), '(')]]",
  loadMore: "//button[span[@aria-label]]",
  pageLoadWaitUntil: "//main"
};

export class InstagramFeedBehavior {
  maxCommentsTime: number;
  postOnlyWindow: any;

  static id = "Instagram";

  static isMatch() {
    return !!window.location.href.match(/https:\/\/(www\.)?instagram\.com\/\w[\w.-]+/);
  }

  static init() {
    return {
      state: {
        posts: 0,
        slides: 0,
        rows: 0,
        comments: 0,
      }
    };
  }

  constructor() {
    this.maxCommentsTime = 10000;
    // extra window for first post, if allowed
    this.postOnlyWindow = null;
  }

  cleanup() {
    if (this.postOnlyWindow) {
      this.postOnlyWindow.close();
      this.postOnlyWindow = null;
    }
  }

  async waitForNext(ctx, child) {
    if (!child) {
      return null;
    }

    await ctx.Lib.sleep(ctx.Lib.waitUnit);

    if (!child.nextElementSibling) {
      return null;
    }

    return child.nextElementSibling;
  }

  async* iterRow(ctx) {
    const { RestoreState, sleep, waitUnit, xpathNode } = ctx.Lib;
    const root = xpathNode(Q.rootPath);

    if (!root) {
      return;
    }

    let child = root.firstElementChild;

    if (!child) {
      return;
    }

    while (child) {
      await sleep(waitUnit);

      const restorer = new RestoreState(Q.childMatchSelect, child);

      if (restorer.matchValue) {
        yield child;

        child = await restorer.restore(Q.rootPath, Q.childMatch);
      }

      child = await this.waitForNext(ctx, child);
    }
  }

  async* viewStandalonePost(ctx, origLoc) {
    const { getState, sleep, waitUnit, waitUntil, xpathNode, xpathString } = ctx.Lib;
    const root = xpathNode(Q.rootPath);

    if (!root?.firstElementChild) {
      return;
    }

    const firstPostHref = xpathString(Q.childMatchSelect, root.firstElementChild);

    yield getState(ctx, "Loading single post view for first post: " + firstPostHref);

    window.history.replaceState({}, "", firstPostHref);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));

    let root2 = null;
    let root3 = null;

    await sleep(waitUnit * 5);

    await waitUntil(() => (root2 = xpathNode(Q.rootPath)) !== root && root2, waitUnit * 5);

    await sleep(waitUnit * 5);

    window.history.replaceState({}, "", origLoc);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));

    await waitUntil(() => (root3 = xpathNode(Q.rootPath)) !== root2 && root3, waitUnit * 5);
    //}
  }

  async *iterSubposts(ctx) {
    const { getState, sleep, waitUnit, xpathNode } = ctx.Lib;
    let next = xpathNode(Q.subpostNextOnlyChevron);

    let count = 1;

    while (next) {
      next.click();
      await sleep(waitUnit * 5);

      yield getState(ctx, `Loading Slide ${++count} for ${window.location.href}`, "slides");

      next = xpathNode(Q.subpostPrevNextChevron);
    }

    await sleep(waitUnit * 5);
  }

  async iterComments(ctx) {
    const { scrollIntoView, sleep, waitUnit, waitUntil, xpathNode } = ctx.Lib;
    const root = xpathNode(Q.commentRoot);

    if (!root) {
      return;
    }

    let child = root.firstElementChild;

    let commentsLoaded = false;

    const getViewRepliesButton = (child) => {
      return xpathNode(Q.viewReplies, child);
    };

    while (child) {
      scrollIntoView(child);

      commentsLoaded = true;

      let viewReplies = getViewRepliesButton(child);

      while (viewReplies) {
        const orig = viewReplies.textContent;
        viewReplies.click();
        ctx.state.comments++;
        await sleep(waitUnit * 2.5);

        await waitUntil(() => orig !== viewReplies.textContent, waitUnit);

        viewReplies = getViewRepliesButton(child);
      }

      if (child.nextElementSibling && child.nextElementSibling.tagName === "LI" && !child.nextElementSibling.nextElementSibling) {
        const loadMore = xpathNode(Q.loadMore, child.nextElementSibling);
        if (loadMore) {
          loadMore.click();
          ctx.state.comments++;
          await sleep(waitUnit * 5);
        }
      }

      child = child.nextElementSibling;
      await sleep(waitUnit * 2.5);
    }

    return commentsLoaded;
  }

  async* iterPosts(ctx, next) {
    const { getState, sleep, waitUnit, xpathNode } = ctx.Lib;
    //let count = 0;

    while (next) {
      next.click();
      await sleep(waitUnit * 10);

      yield getState(ctx, "Loading Post: " + window.location.href, "posts");

      await fetch(window.location.href);

      yield* this.iterSubposts(ctx);

      yield getState(ctx, "Loaded Comments", "comments");

      await Promise.race([
        this.iterComments(ctx),
        sleep(this.maxCommentsTime)
      ]);

      next = xpathNode(Q.nextPost);

      while (!next && xpathNode(Q.postLoading)) {
        await sleep(waitUnit * 2.5);
      }
    }

    await sleep(waitUnit * 5);
  }

  async* run(ctx) {
    const { getState, scrollIntoView, sleep, waitUnit, xpathNode } = ctx.Lib;
    //const origLoc = window.location.href;

    //yield* this.viewStandalonePost(ctx, origLoc);

    for await (const row of this.iterRow(ctx)) {
      scrollIntoView(row);

      await sleep(waitUnit * 2.5);

      yield getState(ctx, "Loading Row", "rows");

      const first = xpathNode(Q.firstPostInRow, row);

      yield* this.iterPosts(ctx, first);

      const close = xpathNode(Q.postCloseButton);
      if (close) {
        close.click();
      }

      await sleep(waitUnit * 5);
    }
  }

  async awaitPageLoad(ctx: any) {
    await awaitInstagramLoad(ctx);
  }
}

export class InstagramPostBehavior extends AutoScroll {
  async awaitPageLoad(ctx: any) {
    await awaitInstagramLoad(ctx);
  }
}

async function awaitInstagramLoad(ctx: any) {
  const { Lib, log } = ctx;
  const { assertContentValid, waitUntilNode } = Lib;

  log("Waiting for Instagram to fully load");

  await waitUntilNode(Q.pageLoadWaitUntil, document, null, 10000);

  assertContentValid(() => !!document.querySelector("*[aria-label='New post']"), "not_logged_in");
}
