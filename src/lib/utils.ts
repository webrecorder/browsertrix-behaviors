import { type Context } from "../behaviorClass";

let _logFunc: (...args: unknown[]) => void | undefined = console.log;
let _behaviorMgrClass = null;

const scrollOpts: ScrollIntoViewOptions = {
  behavior: "smooth",
  block: "center",
  inline: "center",
};

export async function scrollAndClick(
  node: HTMLElement,
  interval = 500,
  opts: ScrollIntoViewOptions | undefined = scrollOpts,
) {
  node.scrollIntoView(opts);
  await sleep(interval);
  node.click();
}

export const waitUnit = 200;

export async function sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export async function waitUntil(pred: () => unknown, interval = waitUnit) {
  while (!pred()) {
    await sleep(interval);
  }
}

export async function waitUntilNode(
  path: string,
  root = document,
  old: Node | null = null,
  timeout = 1000,
  interval = waitUnit,
) {
  let node: Node | null = null;
  let stop = false;
  const waitP = waitUntil(() => {
    node = xpathNode(path, root);
    return stop || (node !== old && node !== null);
  }, interval);
  const timeoutP = new Promise((r) =>
    setTimeout(() => {
      stop = true;
      r("TIMEOUT");
    }, timeout),
  );
  await Promise.race([waitP, timeoutP]);
  return node;
}

export async function awaitLoad(iframe?: HTMLIFrameElement) {
  const doc = iframe ? iframe.contentDocument! : document;
  const win = iframe ? iframe.contentWindow! : window;
  return new Promise((resolve) => {
    if (doc.readyState === "complete") {
      resolve(null);
    } else {
      win.addEventListener("load", resolve);
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unsetToJson(obj: any) {
  if (obj.toJSON) {
    try {
      obj.__bx__toJSON = obj.toJSON;
      delete obj.toJSON;
    } catch (_) {
      // ignore
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function restoreToJson(obj: any) {
  if (obj.__bx__toJSON) {
    try {
      obj.toJSON = obj.__bx__toJSON;
      delete obj.__bx__toJSON;
    } catch (_) {
      // ignore
    }
  }
}

function unsetAllJson() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unsetToJson(Object as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unsetToJson(Object.prototype as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unsetToJson(Array as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unsetToJson(Array.prototype as any);
}

function restoreAllJson() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  restoreToJson(Object as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  restoreToJson(Object.prototype as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  restoreToJson(Array as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  restoreToJson(Array.prototype as any);
}

let needUnsetToJson = false;

export function checkToJsonOverride() {
  needUnsetToJson =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(Object as any).toJSON ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(Object.prototype as any).toJSON ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(Array as any).toJSON ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(Array.prototype as any).toJSON;
}

export async function callBinding<T, U>(
  binding: (obj: T | string) => U,
  obj: T,
): Promise<U> {
  try {
    if (needUnsetToJson) {
      unsetAllJson();
    }
    return binding(obj);
  } catch (_) {
    return binding(JSON.stringify(obj));
  } finally {
    if (needUnsetToJson) {
      restoreAllJson();
    }
  }
}

export async function behaviorLog(data: unknown, type = "debug") {
  if (_logFunc) {
    await callBinding(_logFunc, { data, type });
  }
}

export async function addLink(url: string): Promise<void> {
  if (typeof self["__bx_addLink"] === "function") {
    return await callBinding(self["__bx_addLink"], url);
  }
}

export async function doExternalFetch(url): Promise<boolean> {
  if (typeof self["__bx_fetch"] === "function") {
    return await callBinding(self["__bx_fetch"], url);
  }

  return false;
}

export async function addToExternalSet(url): Promise<boolean> {
  if (typeof self["__bx_addSet"] === "function") {
    return await callBinding(self["__bx_addSet"], url);
  }

  // if set doesn't exist, just return true to avoid skipping
  return true;
}

export async function waitForNetworkIdle(idleTime = 500, concurrency = 0) {
  if (typeof self["__bx_netIdle"] === "function") {
    return await callBinding(self["__bx_netIdle"], { idleTime, concurrency });
  }
}

export async function initFlow(params): Promise<number> {
  if (typeof self["__bx_initFlow"] === "function") {
    return await callBinding(self["__bx_initFlow"], params);
  }

  return -1;
}

export async function nextFlowStep(id: number): Promise<any> {
  if (typeof self["__bx_nextFlowStep"] === "function") {
    return await callBinding(self["__bx_nextFlowStep"], id);
  }

  return { done: true, msg: "" };
}

export async function openWindow(url: string) {
  if (self["__bx_open"]) {
    const p = new Promise((resolve) => (self["__bx_openResolve"] = resolve));
    await callBinding(self["__bx_open"], { url });

    let win = null;

    try {
      win = await p;
      if (win) {
        return win;
      }
    } catch (e) {
      console.warn(e);
    } finally {
      delete self["__bx_openResolve"];
    }
  }

  return window.open(url);
}

export function _setLogFunc(func: (...args: unknown[]) => void | undefined) {
  _logFunc = func;
}

export function _setBehaviorManager(cls) {
  _behaviorMgrClass = cls;
}

export function installBehaviors(obj) {
  obj.__bx_behaviors = new _behaviorMgrClass();
}

// ===========================================================================
export class RestoreState {
  matchValue: string;
  constructor(childMatchSelect: string, child: Node) {
    this.matchValue = xpathString(childMatchSelect, child);
  }

  async restore(rootPath: string, childMatch: string) {
    let root = null;

    while (((root = xpathNode(rootPath)), !root)) {
      await sleep(100);
    }

    return xpathNode(childMatch.replace("$1", this.matchValue), root);
  }
}

// ===========================================================================
export class HistoryState {
  loc: string;
  constructor(op: () => void) {
    this.loc = window.location.href;
    op();
  }

  get changed() {
    return window.location.href !== this.loc;
  }

  async goBack(backButtonQuery: string) {
    if (!this.changed) {
      return Promise.resolve(true);
    }

    const backButton = xpathNode(backButtonQuery) as HTMLElement | null;

    return new Promise((resolve) => {
      window.addEventListener(
        "popstate",
        () => {
          resolve(null);
        },
        { once: true },
      );

      if (backButton) {
        backButton["click"]();
      } else {
        window.history.back();
      }
    });
  }
}

// ===========================================================================
export function xpathNode(path: string, root?: Node | null) {
  root = root || document;
  return document.evaluate(
    path,
    root,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
  ).singleNodeValue;
}

export function* xpathNodes(path: string, root?: Node) {
  root = root || document;
  const iter = document.evaluate(
    path,
    root,
    null,
    XPathResult.ORDERED_NODE_ITERATOR_TYPE,
  );
  let result = null;
  while ((result = iter.iterateNext()) !== null) {
    yield result;
  }
}

export function xpathString(path: string, root?: Node | null) {
  root = root || document;
  return document.evaluate(path, root, null, XPathResult.STRING_TYPE)
    .stringValue;
}

export async function* iterChildElem(
  root: Element,
  timeout: number,
  totalTimeout: number,
) {
  let child = root.firstElementChild;

  while (child) {
    yield child;

    if (!child.nextElementSibling) {
      await Promise.race([
        waitUntil(() => !!child?.nextElementSibling, timeout),
        sleep(totalTimeout),
      ]);
    }

    child = child.nextElementSibling;
  }
}

export async function* iterChildMatches(
  path: string,
  root: Node,
  interval = waitUnit,
  timeout = 5000,
) {
  let node = xpathNode(`.//${path}`, root);
  const getMatch = (node: Node | null) =>
    xpathNode(`./following-sibling::${path}`, node);
  while (node) {
    yield node;
    let next = getMatch(node);
    if (next) {
      node = next;
      continue;
    }
    await Promise.race([
      waitUntil(() => {
        next = getMatch(node);
        return next;
      }, interval),
      sleep(timeout),
    ]);
    node = next;
  }
}

// ===========================================================================
export function isInViewport(elem: Element) {
  const bounding = elem.getBoundingClientRect();
  return (
    bounding.top >= 0 &&
    bounding.left >= 0 &&
    bounding.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    bounding.right <=
      (window.innerWidth || document.documentElement.clientWidth)
  );
}

export function scrollToOffset(element: Element, offset = 0) {
  const elPosition = element.getBoundingClientRect().top;
  const topPosition = elPosition + window.pageYOffset - offset;
  window.scrollTo({ top: topPosition, behavior: "smooth" });
}

export function scrollIntoView(
  element: Element,
  opts: ScrollIntoViewOptions = {
    behavior: "smooth",
    block: "center",
    inline: "center",
  },
) {
  element.scrollIntoView(opts);
}

export function getState<
  StateContext extends Context<{ [K in IncrValue]: number }>,
  const IncrValue extends string,
>(ctx: StateContext, msg: string, incrValue?: IncrValue) {
  if (typeof ctx.state === "undefined") {
    ctx.state = {};
  }
  if (incrValue) {
    if (ctx.state[incrValue] === undefined) {
      (ctx.state as unknown as { [K in IncrValue]: number })[incrValue] = 1;
    } else {
      ctx.state[incrValue]++;
    }
  }

  return { state: ctx.state as StateContext["state"], msg };
}
