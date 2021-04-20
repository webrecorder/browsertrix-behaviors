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
    this.postQuery = ".//a[contains(@href, '/posts/')]";

    this.extraLabel = "//*[starts-with(text(), '+')]";
    this.nextSlideQuery = "//div[@data-name='media-viewer-nav-container']/div[@data-visualcompletion][2]//div[@role='button']";

    this.closeButtonQuery = "//div[@aria-hidden='false']//div[@role='button' and not(@aria-hidden) and @aria-label]";

    this.commentListQuery = ".//ul[(../h3) or (../h4)]";
    this.commentMoreReplies = "./div[2]/div[1]/div[2]/div[@role='button']";
    this.commentMoreComments = "./following-sibling::div/div/div[2][@role='button'][./span/span]";

    this.viewCommentsQuery = ".//h4/..//div[@role='button']";

    this.photoCommentListQuery = "//ul[../h2]";

    this.firstThumbnail = "//div[@role='main']//div[3]//div[contains(@style, 'border-radius')]//div[contains(@style, 'max-width') and contains(@style, 'min-width')]//a[@role='link']";

    this.isPhotoVideoPage = /^.*facebook\.com\/[^/]+\/(photos|videos)/;

    this.isPhotosPage = /^.*facebook\.com\/[^/]+\/photos\/?($|\?)/;

    this.extraWindow = null;

    //todo: make option
    this.allowNewWindow = false;

    this.state = {};
  }

  async* [Symbol.asyncIterator]() {
    yield this.getState("Starting...");

    await sleep(2000);

    if (this.isPhotosPage.exec(window.location.href)) {
      this.state = {"photos": 0, "comments": 0};
      yield* this.iterPhotoSlideShow();
      return;
    }

    if (this.isPhotoVideoPage.exec(window.location.href)) {
      this.state = {"comments": 0};
      const root = xpathNode(this.photoCommentListQuery);
      yield* this.iterComments(root);
      return;
    }

    this.state = {"posts": 0, "comments": 0, "videos": 0};
    yield* this.iterPostFeeds();
  }

  async* iterPostFeeds() {
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

    const postLink = xpathNode(this.postQuery, post);

    let url = "";

    if (postLink) {
      url = new URL(postLink.href, window.location.href);
      url.search = "";
    }

    yield this.getState("Viewing post " + url, "posts");

    post.scrollIntoView(this.scrollOpts);
    
    await sleep(waitUnit * 2);

    if (xpathNode(".//video", post)) {
      yield this.getState("Playing inline video", "videos");
      await sleep(waitUnit * 2);
    }

    //yield* this.viewPhotosOrVideos(post);
    
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

      await sleep(waitUnit * 5);

      obj.click();

      await sleep(waitUnit * 10);
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

  async* iterComments(commentRootUL, maxExpands = 2) {
    if (!commentRootUL) {
      await sleep(waitUnit * 5);
      return;
    }
    let commentBlock = commentRootUL.firstElementChild;
    let lastBlock = null;

    let count = 0;

    while (commentBlock && count < maxExpands) {
      while (commentBlock && count < maxExpands) {
        yield this.getState("Loading comments", "comments");
        commentBlock.scrollIntoView(this.scrollOpts);
        await sleep(waitUnit * 2);

        const moreReplies = xpathNode(this.commentMoreReplies, commentBlock);
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

      let moreButton = xpathNode(this.commentMoreComments, commentRootUL);
      if (moreButton) {
        moreButton.scrollIntoView(this.scrollOpts);
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

  async* iterPhotoSlideShow() {
    const firstPhoto = xpathNode(this.firstThumbnail);

    if (!firstPhoto) {
      return;
    }

    let lastHref = window.location.href;

    firstPhoto.scrollIntoView(this.scrollOpts);
    
    firstPhoto.click();
    await sleep(waitUnit * 5);
    await waitUntil(() => window.location.href !== lastHref, waitUnit * 2);

    let nextSlideButton = null;

    while ((nextSlideButton = xpathNode(this.nextSlideQuery))) {
      lastHref = window.location.href;

      await sleep(waitUnit);
      nextSlideButton.click();
      await sleep(waitUnit * 5);

      await Promise.race([
        waitUntil(() => window.location.href !== lastHref, waitUnit * 2),
        sleep(3000)
      ]);

      if (window.location.href === lastHref) {
        break;
      }

      yield this.getState(`Viewing photo ${window.location.href}`, "photos");

      const root = xpathNode(this.photoCommentListQuery);
      yield* this.iterComments(root, 2);

      await sleep(waitUnit * 5);
    }
  }
}