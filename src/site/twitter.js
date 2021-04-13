import { sleep, xpathNode, xpathString, HistoryState, RestoreState, Behavior, waitUnit } from "../lib/utils";


// ===========================================================================
export class TwitterTimelineBehavior extends Behavior
{
  static isMatch() {
    return window.location.href.match(/https:\/\/(www\.)?twitter\.com\//);
  }

  static get name() {
    return "Twitter";
  }

  constructor(maxDepth = 0) {
    super();
    this.maxDepth = maxDepth || 0;

    //this.rootPath = "//div[starts-with(@aria-label, 'Timeline')]/*[1]";
    this.rootPath = "//h1[@role='heading' and @aria-level='1']/following-sibling::div[@aria-label]/*[1]";
    this.anchorQuery = ".//article";
    this.childMatchSelect = "string(.//article//a[starts-with(@href, '/') and @aria-label]/@href)";
    this.childMatch = "child::div[.//a[@href='$1']]";

    //this.expandQuery = ".//div[@role='button' and @aria-haspopup='false']//*[contains(text(), 'more repl')]";
    this.expandQuery = ".//div[@role='button' and not(@aria-haspopup) and not(@data-testid)]";
    this.quoteQuery = ".//div[@role='blockquote' and @aria-haspopup='false']";

    this.imageQuery = ".//a[@role='link' and starts-with(@href, '/') and contains(@href, '/photo/')]";
    //this.imageNextQuery = "//div[@aria-label='Next slide']";
    this.imageFirstNextQuery = "//div[@aria-roledescription='carousel']/div[2]/div[1]/div[@role='button']";
    this.imageNextQuery = "//div[@aria-roledescription='carousel']/div[2]/div[2]/div[@role='button']";
    //this.imageCloseQuery = "//div[@aria-label='Close' and @role='button']";
    this.imageCloseQuery = "//div[@role='presentation']/div[@role='button' and @aria-label]";
    //this.backButtonQuery = "//div[@aria-label='Back' and @role='button']";
    this.backButtonQuery = "//div[@data-testid='titleContainer']//div[@role='button']";

    this.progressQuery = ".//*[@role='progressbar']";

    //this.promoted = ".//*[text()=\"Promoted\"]";
    this.promoted = ".//div[data-testid='placementTracking']";

    this.seenTweets = new Set();
    this.seenMediaTweets = new Set();

    this.state = {
      tweets: 0,
      images: 0,
      videos: 0,
      //threads: 0,
    };
  }

  async waitForNext(child) {
    if (!child) {
      return null;
    }

    await sleep(waitUnit * 2);

    if (!child.nextElementSibling) {
      return null;
    }

    while (xpathNode(this.progressQuery, child.nextElementSibling)) {
      await sleep(waitUnit);
    }

    return child.nextElementSibling;
  }

  async expandMore(child) {
    const expandElem = xpathNode(this.expandQuery, child);
    if (!expandElem) {
      return child;
    }

    const prev = child.previousElementSibling;
    expandElem.click();
    await sleep(waitUnit);
    while (xpathNode(this.progressQuery, prev.nextElementSibling)) {
      await sleep(waitUnit);
    }
    child = prev.nextElementSibling;
    return child;
  }

  async* infScroll() {
    let root = xpathNode(this.rootPath);

    if (!root) {
      return;
    }

    let child = root.firstElementChild;

    if (!child) {
      return;
    }

    while (child) {
      let anchorElem = xpathNode(this.anchorQuery, child);

      if (!anchorElem && this.expandQuery) {
        child = await this.expandMore(child, this.expandQuery, this.progressQuery);
        anchorElem = xpathNode(this.anchorQuery, child);
      }

      if (child && child.innerText) {
        child.scrollIntoView();      
      }

      if (child && anchorElem) {
        await sleep(waitUnit);

        const restorer = new RestoreState(this.childMatchSelect, child);

        if (restorer.matchValue) {
          yield anchorElem;

          child = await restorer.restore(this.rootPath, this.childMatch);
        }
      }

      child = await this.waitForNext(child, this.progressQuery);
    }
  }

  async* mediaPlaying(tweet) {
    const media = xpathNode("(.//video | .//audio)", tweet);
    if (!media || media.paused) {
      return;
    }

    let msg = "Waiting for media playback";

    try {
      const mediaTweetUrl = new URL(xpathString(this.childMatchSelect, tweet.parentElement), window.location.origin).href;
      if (this.seenMediaTweets.has(mediaTweetUrl)) {
        return;
      }
      msg += " for " + mediaTweetUrl;
      this.seenMediaTweets.add(mediaTweetUrl);
    } catch (e) {
      console.warn(e);
    }

    msg += " to finish...";

    yield this.getState(msg, "videos");

    const p = new Promise((resolve) => {
      media.addEventListener("ended", () => resolve());
      media.addEventListener("abort", () => resolve());
      media.addEventListener("error", () => resolve());
      media.addEventListener("pause", () => resolve());
    });

    await Promise.race([p, sleep(60000)]);
  }

  async* iterTimeline(depth = 0) {
    if (this.seenTweets.has(window.location.href)) {
      return;
    }

    yield this.getState("Capturing thread: " + window.location.href, "threads");

    // iterate over infinite scroll of tweets
    for await (const tweet of this.infScroll()) {
      // skip promoted tweets
      if (xpathNode(this.promoted, tweet)) {
        continue;
      }

      await sleep(waitUnit * 2.5);

      // process images
      yield* this.clickImages(tweet, depth);

      // process quoted tweet
      const quoteTweet = xpathNode(this.quoteQuery, tweet);

      if (quoteTweet) {
        yield* this.clickTweet(quoteTweet, 1000);
      }

      // await any video or audio
      yield* this.mediaPlaying(tweet);


      // track location to see if click goes to new url
      yield* this.clickTweet(tweet, depth);

      // wait before continuing
      await sleep(waitUnit * 5);
    }
  }

  async* clickImages(tweet) {
    const imagePopup = xpathNode(this.imageQuery, tweet);

    if (imagePopup) {
      const imageState = new HistoryState(() => imagePopup.click());

      yield this.getState("Loading Image: " + window.location.href, "images");

      await sleep(waitUnit * 5);

      let nextImage = xpathNode(this.imageFirstNextQuery);
      let prevLocation = window.location.href;

      while (nextImage) {
        nextImage.click();
        await sleep(waitUnit * 2);

        if (window.location.href === prevLocation) {
          await sleep(waitUnit * 5);
          break;
        }
        prevLocation = window.location.href;

        yield this.getState("Loading Image: " + window.location.href, "images");
        await sleep(waitUnit * 5);

        nextImage = xpathNode(this.imageNextQuery);
      }

      await imageState.goBack(this.imageCloseQuery);
    }
  }

  async* clickTweet(tweet, depth) {
    const tweetState = new HistoryState(() => tweet.click());

    await sleep(waitUnit);

    if (tweetState.changed) {
      yield this.getState("Capturing Tweet: " + window.location.href, "tweets");

      if (depth < this.maxDepth && !this.seenTweets.has(window.location.href)) {
        yield* this.iterTimeline(depth + 1, this.maxDepth);
      }

      this.seenTweets.add(window.location.href);

      // wait
      await sleep(waitUnit * 2);

      await tweetState.goBack(this.backButtonQuery);

      await sleep(waitUnit);
    }
  }

  async* [Symbol.asyncIterator]() {
    yield* this.iterTimeline(0);
  }
}
