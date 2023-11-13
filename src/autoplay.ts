import { BackgroundBehavior } from "./lib/behavior";
import { sleep } from "./lib/utils";
import { type AutoFetcher } from "./autofetcher";


// ===========================================================================
export class Autoplay extends BackgroundBehavior {
  mediaSet: Set<string>;
  autofetcher: AutoFetcher;
  numPlaying: number;
  promises: Promise<any>[];
  _initDone: Function;
  running = false;
  polling = false;

  static id = "Autoplay";

  constructor(autofetcher: AutoFetcher, startEarly = false) {
    super();
    this.mediaSet = new Set();
    this.autofetcher = autofetcher;
    this.numPlaying = 0;
    this.promises = [];
    this._initDone = () => null;
    this.promises.push(new Promise((resolve) => this._initDone = resolve));
    if (startEarly) {
      document.addEventListener("DOMContentLoaded", () => this.pollAudioVideo());
    }
  }

  async start() {
    this.running = true;
    //this.initObserver();

    this.pollAudioVideo();

    this._initDone();
  }

  async pollAudioVideo() {
    const run = true;

    if (this.polling) {
      return;
    }

    this.polling = true;

    while (run) {
      for (const [, elem] of document.querySelectorAll("video, audio, picture").entries()) {
        if (!elem["__bx_autoplay_found"]) {

          if (!this.running) {
            if (this.processFetchableUrl(elem)) {
              elem["__bx_autoplay_found"] = true;
            }
            continue;
          }

          await this.loadMedia(elem);
          elem["__bx_autoplay_found"] = true;
        }
      }

      await sleep(500);
    }

    this.polling = false;
  }

  fetchSrcUrl(source) {
    const url: string = source.src || source.currentSrc;

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

      this.attemptMediaPlay(media).then(async (finished: Promise<any> | null) => {
        let check = true;

        if (finished) {
          finished.then(() => check = false);
        }

        while (check) {
          if (this.processFetchableUrl(media)) {
            check = false;
          }
          this.debug("Waiting for fixed URL or media to finish: " + media.currentSrc);
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

    // started promise
    let resolve2;

    const started = new Promise((res) => {
      resolve2 = res;
    });

    started.then(() => this.promises.push(finished));

    media.addEventListener("loadstart", () => { this.debug("media event: loadstart"); resolve2(true); });
    media.addEventListener("playing", () => { this.debug("media event: playing"); resolve2(true); });

    media.addEventListener("loadeddata", () => this.debug("media event: loadeddata"));

    media.addEventListener("ended", () => { this.debug("media event: ended"); resolve(); });
    media.addEventListener("pause", () => { this.debug("media event: pause"); resolve(); });
    media.addEventListener("abort", () => { this.debug("media event: abort"); resolve(); });
    media.addEventListener("error", () => { this.debug("media event: error"); resolve(); });
    media.addEventListener("stalled", () => { this.debug("media event: stalled"); resolve(); });
    media.addEventListener("suspend", () => { this.debug("media event: suspend"); resolve(); });

    media.muted = true;

    const hasA = media.closest("a");

    // if contained in <a> tag, clicking may navigate away, so avoid
    if (!hasA) {
      media.click();

      if (await Promise.race([started, sleep(1000)])) {
        this.debug("play started after media.click()");
        return finished;
      }
    }

    media.play();

    if (await Promise.race([started, sleep(1000)])) {
      this.debug("play started after media.play()");
    }

    return finished;
  }

  done() {
    return Promise.allSettled(this.promises);
  }
}
