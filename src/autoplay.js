import { BackgroundBehavior } from "./lib/behavior";
import { awaitLoad, sleep } from "./lib/utils";


// ===========================================================================
export class Autoplay extends BackgroundBehavior {
  constructor(autofetcher) {
    super();
    
    this.mediaSet = new Set();

    this.autofetcher = autofetcher;

    this.numPlaying = 0;

    this.promises = [];

    this.promises.push(new Promise((resolve) => this._initDone = resolve));

    this.start();
  }

  async start() {
    await awaitLoad();
    //this.initObserver();

    this.pollAudioVideo();

    this._initDone();
  }

  async pollAudioVideo() {
    const run = true;
    
    while (run) {
      for (const [, elem] of document.querySelectorAll("video, audio, picture").entries()) {
        if (!elem.__bx_autoplay_found) {
          elem.__bx_autoplay_found = await this.loadMedia(elem);
        }
      }

      await sleep(500);
    }
  }

  fetchSrcUrl(source) {
    const url = source.src || source.currentSrc;

    if (!url) {
      return false;
    }

    if (!url.startsWith("http:") && !url.startsWith("https:")) {
      return false;
    }

    if (this.mediaSet.has(url)) {
      return true;
    }

    this.debug("fetch media source URL: " + url);
    this.mediaSet.add(url);
    this.autofetcher.queueUrl(url);

    return true;
  }

  async loadMedia(media) {
    this.debug("processing media element: " + media.outerHTML);

    let found = this.fetchSrcUrl(media);

    const sources = media.querySelectorAll("source");

    for (const source of sources) {
      const foundSource = this.fetchSrcUrl(source);
      found = found || foundSource;
    }

    if (!media.play) {
      this.debug("media not playable, skipping");
      return true;
    }

    // if fixed URL found, stop playing
    if (found) {
      if (!media.paused) {
        media.pause();
        this.debug("media URL found, pausing playback");
      }
      return true;
    }

    if (media.paused) {
      this.debug("no src url found, attempting to click or play: " + media.outerHTML);
      await this.attemptMediaPlay(media);
    } else if (media.currentSrc) {
      this.debug("media playing from non-URL source: " + media.currentSrc);
    }

    return false;
  }

  async attemptMediaPlay(media) {
    let resolve;

    const p = new Promise((res) => {
      resolve = res;
    });

    this.promises.push(p);

    let loadingStarted = false;

    media.addEventListener("loadstart", () => {loadingStarted = true; this.debug("loadstart"); });
    media.addEventListener("playing", () => {loadingStarted = true; this.debug("playing"); });
    media.addEventListener("loadeddata", () => this.debug("loadeddata"));
    media.addEventListener("ended", () => { this.debug("ended"); resolve(); });
    media.addEventListener("pause", () => { this.debug("pause"); resolve(); });
    media.addEventListener("abort", () => { this.debug("abort"); resolve(); });
    media.addEventListener("error", () => { this.debug("error"); resolve(); });
    media.addEventListener("stalled", () => { this.debug("stalled"); resolve(); });
    media.addEventListener("suspend", () => { this.debug("suspend"); resolve(); });

    media.muted = true;

    const hasA = media.closest("a");

    // if contained in <a> tag, clicking may navigate away, so avoid
    if (!hasA) {
      //this.debug("click() on media with src: " + media.currentSrc);
      media.click();

      await sleep(500);

      if (loadingStarted) {
        return;
      }
      //this.debug("click() did not initiate loading");
    }

    //this.debug("play() on media with src: " + media.currentSrc);
    media.play();

    await sleep(500);

    if (loadingStarted) {
      return;
    }

    await Promise.race([p, sleep(500)]);
    //this.debug("play() did not initiate loading");
  }

  done() {
    return Promise.allSettled(this.promises);
  }
}

