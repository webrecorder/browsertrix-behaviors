let _logFunc = console.log;
let _behaviorMgrClass = null;

export const waitUnit = 200;

export function sleep(timeout) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export async function waitUntil(pred, interval = waitUnit) {
  while (!pred()) {
    await sleep(interval);
  }
}

export async function waitUntilNode(path, old = null, root = document, timeout = 1000, interval = waitUnit) {
  let node = null;
  let stop = false;
  const waitP = waitUntil(() => {
    node = xpathNode(path, root);
    return stop || (node !== old && node !== null);
  }, interval);
  const timeoutP = new Promise((r) =>
    setTimeout(() => { stop = true; r("TIMEOUT"); }, timeout)
  );
  await Promise.race([waitP, timeoutP]);
  return node;
}

export function awaitLoad() {
  return new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve();
    } else {
      window.addEventListener("load", resolve);
    }
  });
}

function callBinding(binding, obj) {
  try {
    binding(obj);
  } catch (e) {
    binding(JSON.stringify(obj));
  }
}

export function behaviorLog(data, type = "debug") {
  if (_logFunc) {
    callBinding(_logFunc, {data, type});
  }
}

export async function openWindow(url) {
  if (self.__bx_open) {
    const p = new Promise((resolve) => self.__bx_openResolve = resolve);
    callBinding(self.__bx_open, {url});

    let win = null;

    try {
      win = await p;
      if (win) {
        return win;
      }
    } catch (e) {
      console.warn(e);
    } finally {
      delete self.__bx_openResolve;
    }
  }

  return window.open(url);
}

export function _setLogFunc(func) {
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
  constructor(childMatchSelect, child) {
    this.matchValue = xpathString(childMatchSelect, child);
  }

  async restore(rootPath, childMatch) {
    let root = null;

    while (root = xpathNode(rootPath), !root) {
      await sleep(100);
    }

    return xpathNode(childMatch.replace("$1", this.matchValue), root);
  }
}

// ===========================================================================
export class HistoryState {
  constructor(op) {
    this.loc = window.location.href;
    op();
  }

  get changed() {
    return window.location.href !== this.loc;
  }

  goBack(backButtonQuery) {
    if (!this.changed) {
      return Promise.resolve(true);
    }

    const backButton = xpathNode(backButtonQuery);

    return new Promise((resolve) => {
      window.addEventListener("popstate", () => {
        resolve();
      }, {once: true});

      if (backButton) {
        backButton.click();
      } else {
        window.history.back();
      }
    });
  }
}

// ===========================================================================
export function xpathNode(path, root) {
  root = root || document;
  return document.evaluate(path, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue;
}

export function* xpathNodes(path, root) {
  root = root || document;
  let iter = document.evaluate(path, root, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
  let result = null;
  while ((result = iter.iterateNext()) !== null) {
    yield result;
  }
}

export function xpathString(path, root) {
  root = root || document;
  return document.evaluate(path, root, null, XPathResult.STRING_TYPE).stringValue;
}

export async function* iterChildElem(root, timeout, totalTimeout) {
  let child = root.firstElementChild;

  while (child) {
    yield child;

    if (!child.nextElementSibling) {
      await Promise.race([
        waitUntil(() => !!child.nextElementSibling, timeout),
        sleep(totalTimeout)
      ]);
    }

    child = child.nextElementSibling;
  }
}

export async function* iterChildMatches(path, root, timeout, totalTimeout) {
  let child = root.firstElementChild;

  while (child) {
    yield child;

    const matchNode = (node) => node && xpathNode(path, node) ? node : null;
    const getMatch = () => matchNode(child.nextElementSibling);
    if (!getMatch()) {
      await Promise.race([
        waitUntil(() => getMatch(), timeout),
        sleep(totalTimeout)
      ]);
    }

    child = getMatch();
  }
}

// ===========================================================================
export function isInViewport(elem) {
  var bounding = elem.getBoundingClientRect();
  return (
    bounding.top >= 0 &&
      bounding.left >= 0 &&
      bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

export function scrollToOffset(element, offset = 0) {
  const elPosition = element.getBoundingClientRect().top;
  const topPosition = elPosition + window.pageYOffset - offset;
  window.scrollTo({ top: topPosition, behavior: "smooth" });
}
