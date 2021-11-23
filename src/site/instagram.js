import { Behavior } from "../lib/behavior";
//import { behavior_log, installBehaviors } from "../lib/utils";
import { sleep, xpathNode, xpathString, RestoreState, waitUnit, waitUntil } from "../lib/utils";


// ===========================================================================
export class InstagramPostsBehavior extends Behavior
{
  static isMatch() {
    return window.location.href.match(/https:\/\/(www\.)?instagram\.com\/\w[\w]+/);
  }

  static get name() {
    return "Instagram";
  }

  constructor() {
    super();
    this.state = {};
        
    this.rootPath = "//article/div/div";
    this.childMatchSelect = "string(.//a[starts-with(@href, '/')]/@href)";
    this.childMatch = "child::div[.//a[@href='$1']]";

    this.firstPostInRow = "div[1]/a";
    //this.postCloseButton = "//button[.//*[@aria-label=\"Close\"]]";
    this.postCloseButton = "/html/body/div[last()]/div[3]/button[.//*[@aria-label]]";

    //this.nextPost = "//div[@role='dialog']//a[text()='Next']";
    //this.nextPost = "//div[@role='dialog']//a[contains(@class, 'coreSpriteRightPaginationArrow')]";
    this.nextPost = "//button[.//*[local-name() = 'svg' and @aria-label='Next']]";
    this.postLoading = "//*[@aria-label='Loading...']";

    this.subpostNextOnlyChevron = "//article[@role='presentation']//div[@role='presentation']/following-sibling::button";
    this.subpostPrevNextChevron = this.subpostNextOnlyChevron + "[2]";

    //this.commentRoot = "//article/div[3]/div[1]/ul";
    this.commentRoot = "//article[@role='presentation']/div[1]/div[2]//ul";

    //this.viewReplies = "li//button[span[contains(text(), 'View replies')]]";
    this.viewReplies = "//li//button[span[not(count(*)) and text()!='$1']]";
    //this.loadMore = "//button[span[@aria-label='Load more comments']]";
    this.loadMore = "//button[span[@aria-label]]";

    this.maxCommentsTime = 10000;

    // extra window for first post, if allowed
    this.postOnlyWindow = null;

    this.state = {
      posts: 0,
      slides: 0,
      rows: 0,
      comments: 0,
    };
  }

  cleanup() {
    if (this.postOnlyWindow) {
      this.postOnlyWindow.close();
      this.postOnlyWindow = null;
    }
  }

  async waitForNext(child) {
    if (!child) {
      return null;
    }

    await sleep(waitUnit);

    if (!child.nextElementSibling) {
      return null;
    }

    //     while (xpathNode(this.progressQuery, child.nextElementSibling)) {
    //       await sleep(100);
    //     }

    return child.nextElementSibling;
  }

  async* iterRow() {
    let root = xpathNode(this.rootPath);

    if (!root) {
      return;
    }

    let child = root.firstElementChild;

    if (!child) {
      return;
    }

    while (child) {
      await sleep(waitUnit);

      const restorer = new RestoreState(this.childMatchSelect, child);

      if (restorer.matchValue) {
        yield child;

        child = await restorer.restore(this.rootPath, this.childMatch);
      }

      child = await this.waitForNext(child);
    }
  }

  async* viewStandalonePost(origLoc) {
    let root = xpathNode(this.rootPath);

    if (!root || !root.firstElementChild) {
      return;
    }

    const firstPostHref = xpathString(this.childMatchSelect, root.firstElementChild);

    yield this.getState("Loading single post view for first post: " + firstPostHref);

    // const separateWindow = false;

    // if (separateWindow) {
    //   try {
    //     this.postOnlyWindow = window.open(firstPostHref, "_blank", "resizable");

    //     installBehaviors(this.postOnlyWindow);

    //     this.postOnlyWindow.__bx_behaviors.run({autofetch: true});

    //     await sleep(waitUnit * 10);
  
    //   } catch (e) {
    //     behavior_log(e);
    //   }
    // } else {

    window.history.replaceState({}, "", firstPostHref);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));

    let root2 = null;
    let root3 = null;

    await sleep(waitUnit * 5);

    await waitUntil(() => (root2 = xpathNode(this.rootPath)) !== root && root2, waitUnit * 5);

    await sleep(waitUnit * 5);

    window.history.replaceState({}, "", origLoc);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));

    await waitUntil(() => (root3 = xpathNode(this.rootPath)) !== root2 && root3, waitUnit * 5);
    //}
  }

  async *iterSubposts() {
    let next = xpathNode(this.subpostNextOnlyChevron);

    let count = 1;

    while (next) {
      next.click();
      await sleep(waitUnit * 5);

      yield this.getState(`Loading Slide ${++count} for ${window.location.href}`, "slides");

      next = xpathNode(this.subpostPrevNextChevron);
    }

    await sleep(waitUnit * 5);
  }

  async iterComments() {
    const root = xpathNode(this.commentRoot);

    if (!root) {
      return;
    }

    let child = root.firstElementChild;

    let commentsLoaded = false;

    let text = "";

    while (child) {
      child.scrollIntoView(this.scrollOpts);

      commentsLoaded = true;

      let viewReplies = xpathNode(this.viewReplies.replace("$1", text), child);

      while (viewReplies) {
        const orig = viewReplies.textContent;
        viewReplies.click();
        this.state.comments++;
        await sleep(waitUnit * 2.5);

        await waitUntil(() => orig !== viewReplies.textContent, waitUnit);

        text = viewReplies.textContent;
        viewReplies = xpathNode(this.viewReplies.replace("$1", text), child);
      }

      if (child.nextElementSibling && child.nextElementSibling.tagName === "LI" && !child.nextElementSibling.nextElementSibling) {
        let loadMore = xpathNode(this.loadMore, child.nextElementSibling);
        if (loadMore) {
          loadMore.click();
          this.state.comments++;
          await sleep(waitUnit * 5);
        } 
      }

      child = child.nextElementSibling;
      await sleep(waitUnit * 2.5);
    }

    return commentsLoaded;
  }

  async* iterPosts(next) {
    let count = 0;
    
    while (next && ++count <= 3) {
      next.click();
      await sleep(waitUnit * 10);

      yield this.getState("Loading Post: " + window.location.href, "posts");

      await fetch(window.location.href);

      yield* this.iterSubposts();

      yield this.getState("Loaded Comments", "comments");

      await Promise.race([
        this.iterComments(),
        sleep(this.maxCommentsTime)
      ]);

      next = xpathNode(this.nextPost);

      while (!next && xpathNode(this.postLoading)) {
        await sleep(waitUnit * 2.5);
      }
    }

    await sleep(waitUnit * 5);
  }

  async* [Symbol.asyncIterator]() {
    const origLoc = window.location.href;

    for await (const row of this.iterRow()) {
      await sleep(waitUnit * 2.5);

      const first = xpathNode(this.firstPostInRow, row);

      first.click();
      await sleep(waitUnit * 10);

      break;
    }

    yield* this.viewStandalonePost(origLoc);

    for await (const row of this.iterRow()) {
      row.scrollIntoView(this.scrollOpts);

      await sleep(waitUnit * 2.5);

      yield this.getState("Loading Row", "rows");

      const first = xpathNode(this.firstPostInRow, row);

      yield* this.iterPosts(first);

      const close = xpathNode(this.postCloseButton);
      if (close) {
        close.click();
      }

      await sleep(waitUnit * 5);
    }
  }
}
