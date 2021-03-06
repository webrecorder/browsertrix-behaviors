import { sleep, runOnload } from "./lib/utils";


const domainSpecificRedirect = [
  {
    rx: [/w\.soundcloud\.com/],
    handle(url) {
      if (url.searchParams.get("auto_play") === "true") {
        return null;
      }

      url.searchParams.set("auto_play", "true");
      // set continuous_play to true in order to handle
      // a playlist etc
      url.searchParams.set("continuous_play", "true");
      return url.href;
    },
  },
  {
    rx: [/player\.vimeo\.com/, /youtube(?:-nocookie)?\.com\/embed\//],
    handle(url) {
      if (url.searchParams.get("autoplay") === "1") {
        return null;
      }

      url.searchParams.set("autoplay", "1");
      return url.href;
    },
  },
];


// ===========================================================================
export class Autoplay {
  constructor() {
    this.mediaSet = new Set();

    this.promises = [];

    this.start();
  }

  async checkAutoPlayRedirect() {   
    const url = new URL(self.location.href);

    for (const ds of domainSpecificRedirect) {
      for (const rx of ds.rx) {
        if (url.href.search(rx) >= 0) {
          const newUrl = ds.handle(url);
          if (newUrl) {
            await sleep(1000);
            window.location.href = newUrl;
          }
        }
      }
    }
  }

  start() {
    runOnload(() => {
      this.checkAutoPlayRedirect();
      this.initObserver();
    });
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
    if (media.src && media.src.startsWith("http:") || media.src.startsWith("https:")) {
      if (!this.mediaSet.has(media.src)) {
        this.mediaSet.add(media.src);
        this.promises.push(fetch(media.src));
      } else if (media.play) {

        let resolve;

        const p = new Promise((res) => {
          resolve = res;
        });

        media.addEventListener("ended", () => resolve());
        media.addEventListener("paused", () => resolve());
        media.addEventListener("error", () => resolve());

        if (media.paused) {
          media.play();
        }

        this.promises.push(p);
      }
    }
  }

  done() {
    return Promise.all(this.promises);
  }
}

