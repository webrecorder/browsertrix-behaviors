import { BackgroundBehavior } from "./lib/behavior";
import { sleep, awaitLoad } from "./lib/utils";


// const domainSpecificRedirect = [
//   {
//     rx: [/w\.soundcloud\.com/],
//     async handle(url) {
//       if (url.searchParams.get("auto_play") === "true") {
//         return null;
//       }

//       url.searchParams.set("auto_play", "true");
//       // set continuous_play to true in order to handle
//       // a playlist etc
//       url.searchParams.set("continuous_play", "true");
//       return url.href;
//     },
//   },
//   {
//     rx: [/player\.vimeo\.com/],
//     async handle(url) {
//       const video = document.querySelector("video");

//       if (video) {
//         video.play();
//         behavior_log("play video");
//       }
//     }
//   },
//   {
//     rx: [/youtube(?:-nocookie)?\.com\/embed\//],
//     async handle(url) {
//       const center = document.elementFromPoint(
//         document.documentElement.clientWidth / 2,
//         document.documentElement.clientHeight / 2);
      
//       if (center) {
//         center.click();
//         behavior_log("play video");
//         await sleep(1000);
//       }
//     },
//   },
// ];


// ===========================================================================
export class Autoplay extends BackgroundBehavior {
  constructor() {
    super();
    
    this.mediaSet = new Set();

    this.promises = [];

    this.promises.push(new Promise((resolve) => this._initDone = resolve));

    this.start();
  }

  // async checkAutoPlayRedirect() {
  //   await sleep(500);

  //   const url = new URL(self.location.href);

  //   for (const ds of domainSpecificRedirect) {
  //     for (const rx of ds.rx) {
  //       if (url.href.search(rx) >= 0) {
  //         await ds.handle(url);
  //       }
  //     }
  //   }
  // }

  async start() {
    await awaitLoad();
    this.initObserver();
    //await this.checkAutoPlayRedirect();

    for (const [, elem] of document.querySelectorAll("video, audio").entries()) {
      this.addMediaWait(elem);
    }

    await sleep(1000);

    this._initDone();
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
        this.promises.push(fetch(media.src).then(resp => resp.blob()));
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

