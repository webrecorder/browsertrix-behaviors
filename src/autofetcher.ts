// AutoFetcher script
// extract and fetch all urls from srcsets, from images as well as audio/video
// also extract any urls from media query stylesheets that have not necessarily been loaded
// (May not work for cross-origin stylesheets)

import { BackgroundBehavior } from "./lib/behavior";
import { sleep } from "./lib/utils";

const SRC_SET_SELECTOR = "img[srcset], img[data-srcset], img[data-src], noscript > img[src], img[loading='lazy'], " +
  "video[srcset], video[data-srcset], video[data-src], audio[srcset], audio[data-srcset], audio[data-src], " +
  "picture > source[srcset], picture > source[data-srcset], picture > source[data-src], " +
  "video > source[srcset], video > source[data-srcset], video > source[data-src], " +
  "audio > source[srcset], audio > source[data-srcset], audio > source[data-src]";

const SRCSET_REGEX = /\s*(\S*\s+[\d.]+[wx]),|(?:\s*,(?:\s+|(?=https?:)))/;

const STYLE_REGEX = /(url\s*\(\s*[\\"']*)([^)'"]+)([\\"']*\s*\))/gi;
const IMPORT_REGEX = /(@import\s*[\\"']*)([^)'";]+)([\\"']*\s*;?)/gi;

const MAX_CONCURRENT = 6;


// ===========================================================================
export class AutoFetcher extends BackgroundBehavior {
  urlSet: Set<string> = new Set();
  pendingQueue: string[] = [];
  waitQueue: string[] = [];
  mutationObserver: MutationObserver;
  numPending: number = 0;
  numDone: number = 0;
  headers: object;
  _donePromise: Promise<null>;
  _markDone: (value: any) => void;
  active: boolean;
  running = false;

  static id = "AutoFetcher";

  constructor(active = false, headers = null, startEarly = false) {
    super();

    this.headers = headers || {};

    this._donePromise = new Promise((resolve) => this._markDone = resolve);

    this.active = active;
    if (this.active && startEarly) {
      document.addEventListener("DOMContentLoaded", () => this.initObserver());
    }
  }

  get numFetching() {
    return this.numDone + this.numPending + this.pendingQueue.length;
  }

  async start() {
    if (!this.active) {
      return;
    }

    this.initObserver();

    this.run();

    sleep(500).then(() => {
      if (!this.pendingQueue.length && !this.numPending) {
        this._markDone(null);
      }
    });
  }

  done() {
    return this._donePromise;
  }

  async run() {
    this.running = true;

    for (const url of this.waitQueue) {
      this.doFetch(url);
    }
    this.waitQueue = [];

    this.extractSrcSrcSetAll(document);
    this.extractStyleSheets();
  }

  isValidUrl(url: string) {
    return url && (url.startsWith("http:") || url.startsWith("https:"));
  }

  queueUrl(url: string) {
    try {
      url = new URL(url, document.baseURI).href;
    } catch (e) {
      return false;
    }

    if (!this.isValidUrl(url)) {
      return false;
    }

    if (this.urlSet.has(url)) {
      return false;
    }

    this.urlSet.add(url);

    if (!this.running) {
      this.waitQueue.push(url);
    } else {
      this.doFetch(url);
    }

    return true;
  }

  // fetch with default CORS mode, read entire stream
  async doFetchStream(url: string) {
    try {
      const resp = await fetch(url, { "credentials": "include", "referrerPolicy": "origin-when-cross-origin" });
      this.debug(`Autofetch: started ${url}`);

      const reader = resp.body.getReader();

      let res = null;
      while ((res = await reader.read()) && !res.done);

      this.debug(`Autofetch: finished ${url}`);

      return true;

    } catch (e) {
      this.debug(e);

      return false;
    }
  }

  // start non-cors fetch, abort immediately (assumes full streaming by backend)
  async doFetchNonCors(url: string) {
    try {
      const abort = new AbortController();
      await fetch(url, {
        "mode": "no-cors",
        "credentials": "include",
        "referrerPolicy": "origin-when-cross-origin",
        "headers": this.headers,
        abort
      } as {});
      abort.abort();
      this.debug(`Autofetch: started non-cors stream for ${url}`);
    } catch (e) {
      this.debug(`Autofetch: failed non-cors for ${url}`);
    }
  }

  async doFetch(url: string) {
    this.pendingQueue.push(url);
    if (this.numPending <= MAX_CONCURRENT) {
      while (this.pendingQueue.length > 0) {
        const url = this.pendingQueue.shift();

        this.numPending++;

        let success = false;

        // todo: option to use cors or non-cors fetch
        // success = await this.doFetchNonCors();

        if (!success) {
          await this.doFetchNonCors(url);
        }

        this.numPending--;
        this.numDone++;
      }
      if (!this.numPending) {
        this._markDone(null);
      }
    }
  }

  initObserver() {
    if (this.mutationObserver) {
      return;
    }
    this.mutationObserver = new MutationObserver((changes) => this.observeChange(changes));

    this.mutationObserver.observe(document.documentElement, {
      characterData: false,
      characterDataOldValue: false,
      attributes: true,
      attributeOldValue: true,
      subtree: true,
      childList: true,
      attributeFilter: ["srcset", "loading"]
    });
  }

  processChangedNode(target) {
    switch (target.nodeType) {
      case Node.ATTRIBUTE_NODE:
        if (target.nodeName === "srcset") {
          this.extractSrcSetAttr(target.nodeValue);
        }
        if (target.nodeName === "loading" && target.nodeValue === "lazy") {
          const elem = target.parentNode;
          if (elem.tagName === "IMG") {
            elem.setAttribute("loading", "eager");
          }
        }
        break;

      case Node.TEXT_NODE:
        if (target.parentNode && target.parentNode.tagName === "STYLE") {
          this.extractStyleText(target.nodeValue);
        }
        break;

      case Node.ELEMENT_NODE:
        if (target.sheet) {
          this.extractStyleSheet(target.sheet);
        }
        this.extractSrcSrcSet(target);
        setTimeout(() => this.extractSrcSrcSetAll(target), 1000);
        break;
    }
  }

  observeChange(changes) {
    for (const change of changes) {
      this.processChangedNode(change.target);

      if (change.type === "childList") {
        for (const node of change.addedNodes) {
          this.processChangedNode(node);
        }
      }
    }
  }

  extractSrcSrcSetAll(root) {
    const elems = root.querySelectorAll(SRC_SET_SELECTOR);

    for (const elem of elems) {
      this.extractSrcSrcSet(elem);
    }
  }

  extractSrcSrcSet(elem) {
    if (!elem || elem.nodeType !== Node.ELEMENT_NODE) {
      console.warn("No elem to extract from");
      return;
    }

    const data_src = elem.getAttribute("data-src");

    if (data_src) {
      this.queueUrl(data_src);
    }

    // force lazy loading to eager
    if (elem.getAttribute("loading") === "lazy") {
      elem.setAttribute("loading", "eager");
    }

    const srcset = elem.getAttribute("srcset");

    if (srcset) {
      this.extractSrcSetAttr(srcset);
    }

    const data_srcset = elem.getAttribute("data-srcset");

    if (data_srcset) {
      this.extractSrcSetAttr(data_srcset);
    }

    // check regular src in case of <noscript> only to avoid duplicate loading
    const src = elem.getAttribute("src");

    if (src && elem.parentElement.tagName === "NOSCRIPT") {
      this.queueUrl(src);
    }
  }

  extractSrcSetAttr(srcset) {
    for (const v of srcset.split(SRCSET_REGEX)) {
      if (v) {
        const parts = v.trim().split(" ");
        this.queueUrl(parts[0]);
      }
    }
  }

  extractStyleSheets(root?) {
    root = root || document;

    for (const sheet of root.styleSheets) {
      this.extractStyleSheet(sheet);
    }
  }

  extractStyleSheet(sheet) {
    let rules;

    try {
      rules = sheet.cssRules || sheet.rules;
    } catch (e) {
      this.debug("Can't access stylesheet");
      return;
    }

    for (const rule of rules) {
      if (rule.type === CSSRule.MEDIA_RULE) {
        this.extractStyleText(rule.cssText);
      }
    }
  }

  extractStyleText(text) {
    const urlExtractor = (m, n1, n2, n3) => {
      this.queueUrl(n2);
      return n1 + n2 + n3;
    };

    text.replace(STYLE_REGEX, urlExtractor).replace(IMPORT_REGEX, urlExtractor);
  }
}

