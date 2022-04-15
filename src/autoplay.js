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
    for (const [, elem] of document.querySelectorAll("video, audio").entries()) {
      if (!elem.__bx_autoplay_seen) {
        elem.__bx_autoplay_seen = true;
        this.addMediaWait(elem);
      }
    }
  }

  addMediaWait(media) {
    this.debug("media: " + media.outerHTML);
    if (media.src && media.src.startsWith("http:") || media.src.startsWith("https:")) {
      if (!this.mediaSet.has(media.src)) {
        this.debug("fetch media URL: " + media.src);
        this.mediaSet.add(media.src);
        this.autofetcher.queueUrl(media.src);
      }
      return;
    }

    if (media.play) {
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
        (async() => {
          await sleep(500);
          if (!loadingStarted) {
            media.click();
          }
        })();
      }
    }
  }

  done() {
    return Promise.allSettled(this.promises);
  }
}

