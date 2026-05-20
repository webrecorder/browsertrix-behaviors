import { type AbstractBehavior, type Context } from "../lib/behavior";

const subpostNextOnlyChevron =
  "//article[@role='presentation']//div[@role='presentation']/following-sibling::button";

// These queries match the pop-up view from profile pages
const Q = {
  rootPath: "//main//div/div[2]/div/div/div/div",
  childMatchSelect: "string(.//a[starts-with(@href, '/')]/@href)",
  childMatch: "child::div[.//a[@href='$1']]",
  firstPostInRow: "div[1]//a",
  postCloseButton: "//div[last() - 2]//div[@role='button']",
  nextPost: "//button[.//*[local-name() = 'svg' and @aria-label='Next']]",
  postLoading: "//*[@aria-label='Loading...']",
  subpostNextOnlyChevron,
  subpostPrevNextChevron: subpostNextOnlyChevron + "[2]",
  commentRoot:
    "//article[@role='presentation']/div[1]/div[2]//ul/div[last()]/div/div",
  viewReplies: "ul/li//button[span[not(count(*)) and contains(text(), '(')]]",
  loadMore: "//button[span[@aria-label]]",
  pageLoadWaitUntil: "//main",
  // The clickable ring that appears around a user avatar if the user
  // has an active story
  storiesHalo: "//section/div/span/div/div[@role='button']",
  storiesViewStoryButton:
    "//section/div[1]/div/div/div/div/div[2]/div/div[3]/div",
  userPage: /^\/([^/]+)\/?$/,
};

// These queries match the single-page versions
const subpostNextOnlyChevronPage =
  "//div[@role='presentation']/following-sibling::button";
const PageQ = {
  subpostNextOnlyChevron: subpostNextOnlyChevronPage,
  subpostPrevNextChevron: subpostNextOnlyChevronPage + "[2]",
  commentRoot: "//main//hr/following-sibling::div/div/div[last()]",
  viewReplies: "div[last()]/div[@role='button']//span[not(count(*))]",
  loadMore: "//button[div[*[name()='svg' and @aria-label]]]",
};

type InstagramState = {
  comments: number;
  slides: number;
  posts: number;
  rows: number;
  stories: number;
};

export class InstagramPostsBehavior
  implements AbstractBehavior<InstagramState>
{
  maxCommentsTime: number;
  postOnlyWindow: WindowProxy | null;

  static id = "Instagram" as const;

  static isMatch() {
    return !!window.location.href.match(/https:\/\/(www\.)?instagram\.com\//);
  }

  static init() {
    return {
      state: {
        posts: 0,
        slides: 0,
        rows: 0,
        comments: 0,
      },
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

  async waitForNext(ctx: Context<InstagramState>, child: Element | null) {
    if (!child) {
      return null;
    }

    await ctx.Lib.sleep(ctx.Lib.waitUnit);

    if (!child.nextElementSibling) {
      return null;
    }

    return child.nextElementSibling;
  }

  async *iterRow(ctx: Context<InstagramState>) {
    const { RestoreState, sleep, waitUnit, xpathNode } = ctx.Lib;
    const root = xpathNode(Q.rootPath) as Element | null;

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

        child = (await restorer.restore(
          Q.rootPath,
          Q.childMatch,
        )) as Element | null;
      }

      child = await this.waitForNext(ctx, child);
    }
  }

  async *iterSubposts(ctx: Context<InstagramState>, profileView: boolean) {
    const queries = profileView ? Q : PageQ;

    const { getState, sleep, waitUnit, xpathNode } = ctx.Lib;
    let next = xpathNode(queries.subpostNextOnlyChevron) as HTMLElement | null;

    let count = 1;

    while (next) {
      next.click();
      await sleep(waitUnit * 5);

      yield getState(
        ctx,
        `Loading Slide ${++count} for ${window.location.href}`,
        "slides",
      );

      next = xpathNode(queries.subpostPrevNextChevron) as HTMLElement | null;
    }

    await sleep(waitUnit * 5);
  }

  async iterComments(ctx: Context<InstagramState>, profileView: boolean) {
    const queries = profileView ? Q : PageQ;

    const { scrollIntoView, sleep, waitUnit, waitUntil, xpathNode } = ctx.Lib;
    const root = xpathNode(queries.commentRoot) as HTMLElement | null;

    if (!root) {
      return;
    }

    let child = root.firstElementChild;

    let commentsLoaded = false;

    const getViewRepliesButton = (child: Element) => {
      return xpathNode(queries.viewReplies, child) as HTMLElement | null;
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

        await waitUntil(() => orig !== viewReplies?.textContent, waitUnit);

        viewReplies = getViewRepliesButton(child);
      }

      if (
        child.nextElementSibling &&
        // Top element for a comment is div, top element for the
        // "load more" button is li
        child.nextElementSibling.tagName === "LI" &&
        !child.nextElementSibling.nextElementSibling
      ) {
        const loadMore = xpathNode(
          queries.loadMore,
          child.nextElementSibling,
        ) as HTMLElement | null;
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

  async *iterPosts(ctx: Context<InstagramState>, next: HTMLElement | null) {
    const { getState, sleep, waitUnit, xpathNode, addLink } = ctx.Lib;
    //let count = 0;

    while (next) {
      next.click();
      await sleep(waitUnit * 10);

      yield getState(ctx, "Loading Post: " + window.location.href, "posts");

      // Instagram has different page structure when viewing a page from
      // a timeline/profile vs when viewing single pages. Make sure we
      // end up queuing these individual page versions for browsing too.
      await addLink(window.location.href);

      await fetch(window.location.href);

      yield* this.handleSinglePost(ctx, true);

      next = xpathNode(Q.nextPost) as HTMLElement | null;

      while (!next && xpathNode(Q.postLoading)) {
        await sleep(waitUnit * 2.5);
      }
    }

    await sleep(waitUnit * 5);
  }

  async *handleSinglePost(ctx: Context<InstagramState>, profileView: boolean) {
    const { getState, sleep } = ctx.Lib;

    yield* this.iterSubposts(ctx, profileView);

    yield getState(ctx, "Loaded Comments", "comments");

    await Promise.race([
      this.iterComments(ctx, profileView),
      sleep(this.maxCommentsTime),
    ]);
  }

  async *handleStories(ctx: Context<InstagramState>) {
    const { getState, xpathNode } = ctx.Lib;

    yield getState(ctx, "Viewing Stories", "stories");

    // When navigating directly to a story via URL, instagram prompts us
    // whether to click through (because it'll reveal your identity to the
    // original poster)
    //
    // No need to do anything else; stories autoplay once you visit them,
    // including navigation to the next active story from the same account,
    // so we can just hang out on this page and let every story play through.
    const viewStory = xpathNode(Q.storiesViewStoryButton) as HTMLElement | null;
    if (viewStory) {
      viewStory.click();
    }
  }

  async *run(ctx: Context<InstagramState>) {
    if (window.location.pathname.startsWith("/p/")) {
      yield* this.handleSinglePost(ctx, false);
      return;
    }

    if (window.location.pathname.startsWith("/stories/")) {
      yield* this.handleStories(ctx);
      return;
    }

    const { addLink, getState, scrollIntoView, sleep, waitUnit, xpathNode } =
      ctx.Lib;

    // If we're navigating a profile page, queue up this user's stories
    const match = Q.userPage.exec(window.location.pathname);
    if (match) {
      // This element is only present if the user has stories available to view.
      // We're not going to click it, just use it as a sign we should be
      // queuing up the user's stories as a separate URL.
      const storyHalo = xpathNode(Q.storiesHalo) as HTMLElement | null;
      if (storyHalo) {
        const userName = match[1];
        await addLink(`https://instagram.com/stories/${userName}/`);
      }
    }

    for await (const row of this.iterRow(ctx)) {
      scrollIntoView(row);

      await sleep(waitUnit * 2.5);

      yield getState(ctx, "Loading Row", "rows");

      const first = xpathNode(Q.firstPostInRow, row) as HTMLElement | null;

      yield* this.iterPosts(ctx, first);

      const close = xpathNode(Q.postCloseButton) as HTMLElement | null;
      if (close) {
        close.click();
      }

      await sleep(waitUnit * 5);
    }
  }

  async awaitPageLoad(ctx: Context<InstagramState>) {
    const { Lib, log } = ctx;
    const { assertContentValid, waitUntilNode } = Lib;

    void log("Waiting for Instagram to fully load");

    await waitUntilNode(Q.pageLoadWaitUntil, document, null, 10000);

    assertContentValid(
      () => !!document.querySelector("*[aria-label='New post']"),
      "not_logged_in",
    );
  }
}
