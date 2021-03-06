import { Behavior } from "../lib/utils";
import { sleep, xpathNode, xpathString, RestoreState, waitUntil } from "../lib/utils";


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
    this.postCloseButton = "//button[.//*[@aria-label=\"Close\"]]";

    this.nextPost = "//div[@role='dialog']//a[text()='Next']";
    this.postLoading = "//*[@aria-label='Loading...']";

    this.subpostNextOnlyChevron = "//article[@role='presentation']//div[@role='presentation']/following-sibling::button";
    this.subpostPrevNextChevron = this.subpostNextOnlyChevron + "[2]";

    this.commentRoot = "//article/div[3]/div[1]/ul";

    this.viewReplies = "li//button[span[contains(text(), 'View replies')]]";
    this.loadMore = "//button[span[@aria-label='Load more comments']]";

    this.scrollOpts = {block: "start", inline: "nearest", behavior: "smooth"};
  }

  async waitForNext(child) {
    if (!child) {
      return null;
    }

    await sleep(100);

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
      await sleep(100);

      const restorer = new RestoreState(this.childMatchSelect, child);

      if (restorer.matchValue) {
        yield child;

        child = await restorer.restore(this.rootPath, this.childMatch);
      }

      child = await this.waitForNext(child);
    }
  }

  async viewFirstPost() {
    let root = xpathNode(this.rootPath);

    if (!root || !root.firstElementChild) {
      return;
    }

    const firstPostHref = xpathString(this.childMatchSelect, root.firstElementChild);

    const origLoc = window.location.href;

    window.history.replaceState({}, "", firstPostHref);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));

    let root2 = null;
    let root3 = null;

    await waitUntil(() => (root2 = xpathNode(this.rootPath)) !== root && root2, 1000);

    window.history.replaceState({}, "", origLoc);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));

    await waitUntil(() => (root3 = xpathNode(this.rootPath)) !== root2 && root3, 1000);
  }

  async *iterSubposts() {
    let next = xpathNode(this.subpostNextOnlyChevron);

    yield this.state;

    while (next) {
      next.click();
      await sleep(1000);

      next = xpathNode(this.subpostPrevNextChevron);
    }

    await sleep(1000);
  }

  async iterComments() {
    const root = xpathNode(this.commentRoot);

    let child = root.firstElementChild;

    while (child) {
      child.scrollIntoView(this.scrollOpts);

      let viewReplies;

      while ((viewReplies = xpathNode(this.viewReplies, child)) !== null) {
        viewReplies.click();
        await sleep(500);
      }

      if (child.nextElementSibling && child.nextElementSibling.tagName === "LI") {
        let loadMore = xpathNode(this.loadMore, child.nextElementSibling);
        if (loadMore) {
          loadMore.click();
          await sleep(1000);
        } 
      }

      child = child.nextElementSibling;
      await sleep(500);
    }
  }

  async* iterPosts(next) {
    let count = 0;
    
    while (next && ++count <= 3) {
      next.click();
      await sleep(1000);

      await fetch(window.location.href);

      yield* this.iterSubposts();

      await Promise.race([
        this.iterComments(),
        sleep(20000)
      ]);

      next = xpathNode(this.nextPost);

      while (!next && xpathNode(this.postLoading)) {
        await sleep(500);
      }
    }

    await sleep(1000);
  }

  async* [Symbol.asyncIterator]() {   
    await this.viewFirstPost();
    
    for await (const row of this.iterRow()) {
      row.scrollIntoView(this.scrollOpts);

      await sleep(500);

      const first = xpathNode(this.firstPostInRow, row);

      yield* this.iterPosts(first);

      const close = xpathNode(this.postCloseButton);
      if (close) {
        close.click();
      }

      await sleep(1000);
    }
  }

  async run() {
    for await (const result of this) {
      console.log("scroll instagram row", result);
    }
  }
}
