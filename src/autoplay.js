import { BackgroundBehavior } from "./lib/behavior";
import { awaitLoad, sleep } from "./lib/utils";


// ===========================================================================
export class Autoplay extends BackgroundBehavior {
  constructor(autofetcher) {
    super();
    
    this.mediaSet = new Set();

    this.autofetcher = autofetcher;

    this.promises = [];

    this.promises.push(new Promise((resolve) => this._initDone = resolve));

    this.start();
  }

  async start() {
    await awaitLoad();
    //this.initObserver();

    this.pollAudioVideo();

    setInterval(() => this.pollAudioVideo(), 500);

    this._initDone();
  }

  pollAudioVideo() {
    for (const [, elem] of document.querySelectorAll("video, audio, picture").entries()) {
      if (!elem.__bx_autoplay_seen) {
        elem.__bx_autoplay_seen = true;
        this.addMediaWait(elem);
      }
    }
  }

  fetchSrcUrl(source) {
    if (!source.src) {
      return false;
    }

    const url = source.src;

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

  addMediaWait(media) {
    this.debug("media: " + media.outerHTML);

    let found = this.fetchSrcUrl(media);

    const sources = media.querySelectorAll("source");

    for (const source of sources) {
      const foundSource = this.fetchSrcUrl(source);
      found = found || foundSource;
    }

    if (!found && media.play) {
      this.attemptMediaPlay(media);
    }
  }

  async attemptMediaPlay(media) {
    let resolve;

    const p = new Promise((res) => {
      resolve = res;
    });

    this.promises.push(p);

    let loadingStarted = false;

    media.addEventListener("loadstart", () => {loadingStarted = true; this.debug("loadstart"); });
    media.addEventListener("loadeddata", () => this.debug("loadeddata"));
    media.addEventListener("playing", () => { this.debug("playing"); resolve(); });
    media.addEventListener("ended", () => { this.debug("ended"); resolve(); });
    media.addEventListener("pause", () => { this.debug("pause"); resolve(); });
    media.addEventListener("abort", () => { this.debug("abort"); resolve(); });
    media.addEventListener("error", () => { this.debug("error"); resolve(); });
    media.addEventListener("stalled", () => { this.debug("stalled"); resolve(); });
    media.addEventListener("suspend", () => { this.debug("suspend"); resolve(); });

    if (media.paused) {
      this.debug("generic play event for: " + media.outerHTML);
      media.muted = true;
      //media.play().reject(() => media.click()).finally(() => resolve());
      media.play();

      await sleep(500);

      if (loadingStarted) {
        return;
      }

      const hasA = media.closest("a");

      // if contained in <a> tag, clicking may navigate away, so avoid
      if (!hasA) {
        media.click();
      }
    }
  }

  done() {
    return Promise.allSettled(this.promises);
  }
}

