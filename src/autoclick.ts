import { BackgroundBehavior } from "./lib/behavior";
import { sleep } from "./lib/utils";

declare let getEventListeners: any;

export class AutoClick extends BackgroundBehavior
{
  _donePromise: Promise<void>;
  _markDone: () => void;
  selector: string;
  seenElem = new WeakSet<HTMLElement>();

  constructor(selector = "a") {
    super();
    this.selector = selector;
    this._donePromise = new Promise<void>((resolve) => this._markDone = resolve);
  }

  nextSameOriginLink(origNoHash: string) : HTMLAnchorElement | null {
    try {
      const allLinks = document.querySelectorAll(this.selector);
      for (const el of allLinks) {
        const elem = el as HTMLAnchorElement;

        // skip URLs to same page OR outside current origin
        if (!elem.href || !elem.href.startsWith(self.location.origin) || elem.href.startsWith(origNoHash)) {
          continue;
        }
        if (!elem.isConnected) {
          continue;
        }
        if (this.seenElem.has(elem)) {
          continue;
        }
        this.seenElem.add(elem);
        return elem;
      }
    } catch (e) {
      this.debug(e.toString());
    }

    return null;
  }

  async start() {
    const origHref = self.location.href;
    
    const url = new URL(origHref);
    url.hash = "";
    const origNoHash = url.href + "#";

    const beforeUnload = (event) => {
      event.preventDefault();
      return false;
    };

    // process all links (except hash links) which could result in attempted navigation
    window.addEventListener("beforeunload", beforeUnload);

    // process external links on current origin

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const elem = this.nextSameOriginLink(origNoHash);

      if (!elem) {
        break;
      }

      await this.processElem(elem, origHref);
    }

    // process hashlinks on same page
    for (const el of document.querySelectorAll(this.selector)) {
      const elem = el as HTMLAnchorElement;
      if (!elem.href || elem.href.startsWith(origNoHash)) {
        await this.processElem(elem, origHref);
      }
    }

    window.removeEventListener("beforeunload", beforeUnload);

    this._markDone();
  }

  async processElem(elem: HTMLAnchorElement, origHref: string) {
    if (!elem.isConnected) {
      return;
    }

    // if successfully called getEventListeners and no click handler, we can skip
    try {
      if (!getEventListeners(elem).click) {
        return;
      }
    } catch (_e) {
      // getEventListeners not available, need to actually click
    }

    if (elem.target) {
      return;
    }

    const anySelf = self as any;

    if (elem.href) {
      // skip if already clicked this URL, tracked in external state
      if (anySelf.__bx_addSet && !await anySelf.__bx_addSet(elem.href)) {
        return;
      }

      this.debug("Clicking on link: " + elem.href);
    } else {
      this.debug("Click empty link");
    }

    elem.click();

    await sleep(250);

    if (self.location.href != origHref) {
      await new Promise((resolve) => {
        window.addEventListener("popstate", () => {
          resolve(null);
        }, { once: true });

        window.history.back();
      });
    }
  } catch (e) {
    this.debug(e.toString());
  }

  done() {
    return this._donePromise;
  }
}
