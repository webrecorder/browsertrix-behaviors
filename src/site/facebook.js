import { Behavior } from "../lib/behavior";
import { xpathNodes, iterChildElem, sleep, xpathNode, waitUnit, waitUntil, openWindow } from "../lib/utils";


// ===========================================================================
export class FacebookTimelineBehavior extends Behavior
{
  static isMatch() {
    return window.location.href.match(/https:\/\/(www\.)?facebook\.com\//);
  }

  static get name() {
    return "Facebook";
  }

  constructor() {
    super();
    this.feedQuery = "//div[@role='feed']";
    this.articleQuery = ".//div[@role='article']";
    this.pageletPostList = "//div[@data-pagelet='page']/div[@role='main']//div[@role='main']/div";
    this.pageletProfilePostList = "//div[@data-pagelet='page']//div[@data-pagelet='ProfileTimeline']";

    this.photosOrVideosQuery = `.//a[(contains(@href, '/photos/') or contains(@href, '/photo/?') or contains(@href, '/videos/')) and (starts-with(@href, '${window.location.origin}/') or starts-with(@href, '/'))]`;
  
    this.extraLabel = "//*[starts-with(text(), '+')]";
    this.nextSlideQuery = "//div[@data-name='media-viewer-nav-container']/div[@data-visualcompletion][2]//div[@role='button']";

    this.closeButtonQuery = "//div[@aria-hidden='false']//div[@role='button' and not(@aria-hidden) and @aria-label]";

    this.commentListQuery = ".//ul[(../h3) or (../h4)]";
    this.commentMoreReplies = "./div[2]/div[1]/div[2]/div[@role='button']";
    this.commentMoreComments = "./following-sibling::div/div/div[2][@role='button'][./span/span]";

    this.viewCommentsQuery = ".//h4/..//div[@role='button']";

    this.photoCommentListQuery = "//ul[../h2]";

    this.isPhotoVideoPage = /^.*facebook\.com\/[^/]+\/(photos|videos)/;

    this.extraWindow = null;

    //todo: make option
    this.allowNewWindow = false;

    this.state = {
      posts: 0,
      comments: 0,
      photos: 0,
      videos: 0,
    };
  }

  async* [Symbol.asyncIterator]() {
    if (this.isPhotoVideoPage.exec(window.location.href)) {
      const root = xpathNode(this.photoCommentListQuery);
      yield* this.iterComments(root);
      return;
    }

    const feeds = Array.from(xpathNodes(this.feedQuery));
    if (feeds && feeds.length) {
      for (const feed of feeds) {
        for await (const post of iterChildElem(feed, waitUnit, waitUntil * 10)) {
          yield* this.viewPost(xpathNode(this.articleQuery, post));
        }
      }
    } else {
      const feed = xpathNode(this.pageletPostList) || xpathNode(this.pageletProfilePostList);
      for await (const post of iterChildElem(feed, waitUnit, waitUntil * 10)) {
        yield* this.viewPost(xpathNode(this.articleQuery, post));
      }
    }

    if (this.extraWindow) {
      this.extraWindow.close();
    }
  }

  async* viewPost(post) {
    if (!post) {
      return;
    }
    yield this.getState("Viewing post", "posts");

    post.scrollIntoView(this.scrollOpts);
    
    await sleep(waitUnit * 2);

    yield* this.viewPhotosOrVideos(post);
    
    let commentRootUL = xpathNode(this.commentListQuery, post);
    if (!commentRootUL) {
      const viewCommentsButton = xpathNode(this.viewCommentsQuery, post);
      if (viewCommentsButton) {
        viewCommentsButton.click();
        await sleep(waitUnit * 2);
      }
      commentRootUL = xpathNode(this.commentListQuery, post);
    }
    yield* this.iterComments(commentRootUL);

    await sleep(waitUnit * 5);
  }

  async* viewPhotosOrVideos(post) {
    const objects = Array.from(xpathNodes(this.photosOrVideosQuery, post));

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

      yield this.getState(`Viewing ${type} ${url.href}`, type);

      obj.scrollIntoView();

      await sleep(waitUnit * 3);

      obj.click();

      await sleep(waitUnit * 20);
      //await sleep(10000);

      if (this.allowNewWindow) {
        await this.openNewWindow(url.href);
      }

      if (count === objects.length) {
        yield* this.viewExtraObjects(obj, type, this.allowNewWindow);
      }

      const close = xpathNode(this.closeButtonQuery);

      if (close) {
        close.click();
        await sleep(waitUnit * 2);
      }
    }
  }

  async* viewExtraObjects(obj, type, openNew) {
    const extraLabel = xpathNode(this.extraLabel, obj);

    if (!extraLabel) {
      return;
    }

    const num = Number(extraLabel.innerText.slice(1));
    if (isNaN(num)) {
      return;
    }

    let lastHref;

    for (let i = 0; i < num; i++) {
      const nextSlideButton = xpathNode(this.nextSlideQuery);

      if (!nextSlideButton) {
        continue;
      }

      lastHref = window.location.href;

      nextSlideButton.click();
      await sleep(waitUnit * 5);

      await waitUntil(() => window.location.href !== lastHref, waitUnit * 2);

      yield this.getState(`Viewing extra ${type} ${window.location.href}`);

      if (openNew) {
        await this.openNewWindow(window.location.href);
      }
    }
  }

  async openNewWindow(url) {
    if (!this.extraWindow) {
      this.extraWindow = await openWindow(url);
    } else {
      this.extraWindow.location.href = url;
    }
  }

  async* iterComments(commentRootUL) {
    if (!commentRootUL) {
      return;
    }
    let commentBlock = commentRootUL.firstElementChild;
    let lastBlock = null;

    while (commentBlock) {
      while (commentBlock) {
        yield this.getState("Loading comments", "comments");
        commentBlock.scrollIntoView(this.scrollOpts);

        const moreReplies = xpathNode(this.commentMoreReplies, commentBlock);
        if (moreReplies) {
          moreReplies.click();
          await sleep(waitUnit * 5);
        }

        lastBlock = commentBlock;
        commentBlock = lastBlock.nextElementSibling;
      }

      let moreButton = xpathNode(this.commentMoreComments, commentRootUL);
      if (moreButton) {
        moreButton.scrollIntoView(this.scrollOpts);
        moreButton.click();
        await sleep(waitUnit * 5);
        if (lastBlock) {
          commentBlock = lastBlock.nextElementSibling;
        }
      }
    }
  }
}