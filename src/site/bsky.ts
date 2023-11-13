const Q = {
  rootPath: "//h1[@role='heading' and @aria-level='1']/following-sibling::div[@aria-label]//div[@style]",
  anchor: ".//article",
  childMatchSelect: "string(.//article//a[starts-with(@href, '/') and @aria-label]/@href)",
  childMatch: "child::div[.//a[@href='$1']]",
  expand: ".//div[@role='button' and not(@aria-haspopup) and not(@data-testid)]",
  quote: ".//div[@role='blockquote' and @aria-haspopup='false']",
  image: ".//a[@role='link' and starts-with(@href, '/') and contains(@href, '/photo/')]",
  imageFirstNext: "//div[@aria-roledescription='carousel']/div[2]/div[1]//div[@role='button']",
  imageNext: "//div[@aria-roledescription='carousel']/div[2]/div[2]//div[@role='button']",
  imageClose: "//div[@role='presentation']/div[@role='button' and @aria-label]",
  backButton: "//div[@data-testid='titleContainer']//div[@role='button']",
  viewSensitive: ".//a[@href='/settings/content_you_see']/parent::div/parent::div/parent::div//div[@role='button']",
  progress: ".//*[@role='progressbar']",
  promoted: ".//div[data-testid='placementTracking']",
};

export class BskyTimelineBehavior {
  seenTweets: Set<any>;
  seenMediaTweets: Set<any>;

  static id = "BSky"

  static isMatch() {
    return !!window.location.href.match(/https:\/\/(www\.)?bsky\.app\//);
  }

  static init() {
    return {
      state: {
        tweets: 0,
        images: 0,
        videos: 0
      },
      opts: {
        maxDepth: 0
      }
    };
  }

  constructor() {
    this.seenTweets = new Set();
    this.seenMediaTweets = new Set();
  }

  showingProgressBar(ctx, root) {
    const { xpathNode } = ctx.Lib;
    const node = xpathNode(Q.progress, root);
    if (!node) {
      return false;
    }
    // return false is hidden / no-height
    return node.clientHeight > 10;
  }

  async waitForNext(ctx, child) {
    const { sleep, waitUnit } = ctx.Lib;
    if (!child) {
      return null;
    }

    await sleep(waitUnit * 2);

    if (!child.nextElementSibling) {
      return null;
    }

    while (this.showingProgressBar(ctx, child.nextElementSibling)) {
      await sleep(waitUnit);
    }

    return child.nextElementSibling;
  }

  async expandMore(ctx, child) {
    const { sleep, waitUnit, xpathNode } = ctx.Lib;
    const expandElem = xpathNode(Q.expand, child);
    if (!expandElem) {
      return child;
    }

    const prev = child.previousElementSibling;
    expandElem.click();
    await sleep(waitUnit);
    while (this.showingProgressBar(ctx, prev.nextElementSibling)) {
      await sleep(waitUnit);
    }
    child = prev.nextElementSibling;
    return child;
  }

  async* infScroll(ctx) {
    const { scrollIntoView, RestoreState, sleep, waitUnit, xpathNode } = ctx.Lib;
    let root = xpathNode(Q.rootPath);

    if (!root) {
      return;
    }

    let child = root.firstElementChild;

    if (!child) {
      return;
    }

    while (child) {
      let anchorElem = xpathNode(Q.anchor, child);

      if (!anchorElem && Q.expand) {
        child = await this.expandMore(ctx, child);
        anchorElem = xpathNode(Q.anchor, child);
      }

      if (child && child.innerText) {
        scrollIntoView(child);
      }

      if (child && anchorElem) {
        await sleep(waitUnit);

        const restorer = new RestoreState(Q.childMatchSelect, child);

        yield anchorElem;

        if (restorer.matchValue) {
          child = await restorer.restore(Q.rootPath, Q.childMatch);
        }
      }

      child = await this.waitForNext(ctx, child);
    }
  }

  async* mediaPlaying(ctx, tweet) {
    const { getState, sleep, xpathNode, xpathString } = ctx.Lib;
    const media = xpathNode("(.//video | .//audio)", tweet);
    if (!media || media.paused) {
      return;
    }

    let mediaTweetUrl = null;

    try {
      mediaTweetUrl = new URL(xpathString(Q.childMatchSelect, tweet.parentElement), window.location.origin).href;
    } catch (e) {
      console.warn(e);
    }

    // no need to wait for mp4s, should be loaded fully automatically
    if (media.src.startsWith("https://") && media.src.indexOf(".mp4") > 0) {
      yield getState(ctx, `Loading video for ${mediaTweetUrl || "unknown"}`, "videos");
      return;
    }

    let msg;

    if (mediaTweetUrl) {
      if (this.seenMediaTweets.has(mediaTweetUrl)) {
        return;
      }

      msg = `Waiting for media playback for ${mediaTweetUrl} to finish`;
      this.seenMediaTweets.add(mediaTweetUrl);
    } else {
      msg = "Loading video";
    }

    yield getState(ctx, msg, "videos");

    const p = new Promise((resolve) => {
      media.addEventListener("ended", () => resolve(null));
      media.addEventListener("abort", () => resolve(null));
      media.addEventListener("error", () => resolve(null));
      media.addEventListener("pause", () => resolve(null));
    });

    await Promise.race([p, sleep(60000)]);
  }

  async* clickImages(ctx, tweet) {
    const { getState, HistoryState, sleep, waitUnit, xpathNode } = ctx.Lib;
    const imagePopup = xpathNode(Q.image, tweet);

    if (imagePopup) {
      const imageState = new HistoryState(() => imagePopup.click());

      yield getState(ctx, "Loading Image: " + window.location.href, "images");

      await sleep(waitUnit * 5);

      let nextImage = xpathNode(Q.imageFirstNext);
      let prevLocation = window.location.href;

      while (nextImage) {
        nextImage.click();
        await sleep(waitUnit * 2);

        if (window.location.href === prevLocation) {
          await sleep(waitUnit * 5);
          break;
        }
        prevLocation = window.location.href;

        yield getState(ctx, "Loading Image: " + window.location.href, "images");
        await sleep(waitUnit * 5);

        nextImage = xpathNode(Q.imageNext);
      }

      await imageState.goBack(Q.imageClose);
    }
  }

  async* clickTweet(ctx, tweet, depth) {
    const { getState, HistoryState, sleep, waitUnit } = ctx.Lib;
    const tweetState = new HistoryState(() => tweet.click());

    await sleep(waitUnit);

    if (tweetState.changed) {
      yield getState(ctx, "Capturing Tweet: " + window.location.href, "tweets");
      const maxDepth = ctx.opts.maxDepth;
      if (depth < maxDepth && !this.seenTweets.has(window.location.href)) {
        yield* this.iterTimeline(ctx, depth + 1);
      }

      this.seenTweets.add(window.location.href);

      // wait
      await sleep(waitUnit * 2);

      await tweetState.goBack(Q.backButton);

      await sleep(waitUnit);
    }
  }

  async* iterTimeline(ctx, depth = 0) {
    const { getState, sleep, waitUnit, xpathNode } = ctx.Lib;
    if (this.seenTweets.has(window.location.href)) {
      return;
    }

    yield getState(ctx, "Capturing thread: " + window.location.href, "threads");

    // iterate over infinite scroll of tweets
    for await (const tweet of this.infScroll(ctx)) {
      // skip promoted tweets
      if (xpathNode(Q.promoted, tweet)) {
        continue;
      }

      await sleep(waitUnit * 2.5);

      const viewButton = xpathNode(Q.viewSensitive, tweet);
      if (viewButton) {
        viewButton.click();
        await sleep(waitUnit * 2.5);
      }

      // process images
      yield* this.clickImages(ctx, tweet);

      // process quoted tweet
      const quoteTweet = xpathNode(Q.quote, tweet);

      if (quoteTweet) {
        yield* this.clickTweet(ctx, quoteTweet, 1000);
      }

      // await any video or audio
      yield* this.mediaPlaying(ctx, tweet);

      // track location to see if click goes to new url
      yield* this.clickTweet(ctx, tweet, depth);

      // wait before continuing
      await sleep(waitUnit * 5);
    }
  }

  async* run(ctx) {
    yield* this.iterTimeline(ctx, 0);
  }
}
