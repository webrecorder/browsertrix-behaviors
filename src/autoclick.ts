import { BackgroundBehavior } from "./lib/behavior";
import { addToExternalSet, sleep } from "./lib/utils";

export class AutoClick extends BackgroundBehavior {
  _donePromise: Promise<void>;
  _markDone!: () => void;
  selector: string;
  seenElem = new WeakSet<HTMLElement>();

  static id = "Autoclick" as const;

  constructor(selector = "a") {
    super();
    this.selector = selector;
    this._donePromise = new Promise<void>(
      (resolve) => (this._markDone = resolve),
    );
  }

  nextSameOriginLink(): HTMLAnchorElement | null {
    try {
      const allLinks = document.querySelectorAll(this.selector);
      for (const el of allLinks) {
        const elem = el as HTMLAnchorElement;

        // skip URLs to different origin as they won't be handled dynamically, most likely just regular navigation
        if (elem.href && !elem.href.startsWith(self.location.origin)) {
          continue;
        }
        if (!elem.isConnected) {
          continue;
        }
        if (!elem.checkVisibility()) {
          continue;
        }
        if (this.seenElem.has(elem)) {
          continue;
        }
        this.seenElem.add(elem);
        return elem;
      }
    } catch (e) {
      this.debug((e as Error).toString());
    }

    return null;
  }

  async start() {
    const origHref = self.location.href;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      return false;
    };

    // process all links (except hash links) which could result in attempted navigation
    window.addEventListener("beforeunload", beforeUnload);

    // process external links on current origin

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      const elem = this.nextSameOriginLink();

      if (!elem) {
        break;
      }

      await this.processElem(elem, origHref);
    }

    window.removeEventListener("beforeunload", beforeUnload);

    this._markDone();
  }

  async processElem(elem: HTMLAnchorElement, origHref: string) {
    if (elem.target) {
      return;
    }

    if (elem.href) {
      // skip if already clicked this URL, tracked in external state
      if (!(await addToExternalSet(elem.href))) {
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
        window.addEventListener(
          "popstate",
          () => {
            resolve(null);
          },
          { once: true },
        );

        window.history.back();
      });
    }
  }
  // @ts-expect-error TODO: this looks like a typo, there's no associated `try` block for this `catch` block, so it ends up being a method
  catch(e) {
    this.debug(e.toString());
  }

  async done() {
    return this._donePromise;
  }
}
