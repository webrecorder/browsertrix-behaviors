import { BackgroundBehavior } from "./lib/behavior";
import { awaitLoad } from "./lib/utils";


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

    //await sleep(500);

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

  initObserver() {
    this.mutobz = new MutationObserver((changes) => this.observeChange(changes));

    this.mutobz.observe(document.documentElement, {
      characterData: false,
      characterDataOldValue: false,
      attributes: false,
      attributeOldValue: false,
      subtree: true,
      childList: true,
    });
  }

  observeChange(changes) {
    for (const change of changes) {
      if (change.type === "childList") {
        for (const node of change.addedNodes) {
          if (node instanceof HTMLMediaElement) {
            this.addMediaWait(node);
          }
        }
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
        return;
      }
    }

    if (media.play) {
      let resolve;

      const p = new Promise((res) => {
        resolve = res;
      });

      this.promises.push(p);

      media.addEventListener("loadstart", () => this.debug("loadstart"));
      media.addEventListener("loadeddata", () => this.debug("loadeddata"));
      media.addEventListener("playing", () => { this.debug("playing"); resolve(); });
      media.addEventListener("ended", () => { this.debug("ended"); resolve(); });
      media.addEventListener("paused", () => { this.debug("paused"); resolve(); });
      media.addEventListener("error", () => { this.debug("error"); resolve(); });

      if (media.paused) {
        this.debug("generic play event for: " + media.outerHTML);
        media.muted = true;
        media.click();
        media.play();
      }
    }
  }

  done() {
    return Promise.allSettled(this.promises);
  }
}

