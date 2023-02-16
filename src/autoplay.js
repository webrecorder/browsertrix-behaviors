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
          await this.loadMedia(elem);
          elem.__bx_autoplay_found = true;
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

  processFetchableUrl(media) {
    let found = this.fetchSrcUrl(media);

    const sources = media.querySelectorAll("source");

    for (const source of sources) {
      const foundSource = this.fetchSrcUrl(source);
      found = found || foundSource;
    }

    return found;
  }

  async loadMedia(media) {
    this.debug("processing media element: " + media.outerHTML);

    const found = this.processFetchableUrl(media);

    if (!media.play) {
      this.debug("media not playable, skipping");
      return;
    }

    // if fixed URL found, stop playing
    if (found) {
      if (!media.paused) {
        media.pause();
        this.debug("media URL found, pausing playback");
      }
      return;
    }

    if (media.paused) {
      this.debug("no src url found, attempting to click or play: " + media.outerHTML);
      
      this.attemptMediaPlay(media).then(async (finished) => {
        let check = true;
        
        if (finished) {
          finished.then(() => check = false);
        }

        while (check) {
          if (this.processFetchableUrl(media)) {
            check = false;
          }
          this.debug("Waiting for fixed URL or media to finish: " + media.outerHTML);
          await sleep(1000);
        }

      });

    } else if (media.currentSrc) {
      this.debug("media playing from non-URL source: " + media.currentSrc);
    }
  }

  async attemptMediaPlay(media) {
    // finished promise
    let resolve;

    const finished = new Promise((res) => {
      resolve = res;
    });

    this.promises.push(finished);

    // started promise
    let resolve2;

    const started = new Promise((res) => {
      resolve2 = res;
    });

    let loadingStarted = false;

    media.addEventListener("loadstart", () => { loadingStarted = true; this.debug("loadstart"); resolve2(true); });
    media.addEventListener("playing", () => { loadingStarted = true; this.debug("playing"); resolve2(true); });

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
        return finished;
      }
      //this.debug("click() did not initiate loading");
    }

    //this.debug("play() on media with src: " + media.currentSrc);
    media.play();

    await started;

    return finished;
  }

  done() {
    return Promise.allSettled(this.promises);
  }
}

