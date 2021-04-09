let _logFunc = console.log;
let _behaviorMgrClass = null;

export const waitUnit = 200;

export function sleep(timeout) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export async function waitUntil(pred, timeout) {
  while (!pred()) {
    await sleep(timeout);
  }
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

export function behavior_log(data, type = "debug") {
  if (_logFunc) {
    try {
      _logFunc({data, type});
    } catch (e) {
      _logFunc(JSON.stringify({data, type}));
    }
  }
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

// ===========================================================================
export class Behavior
{
  constructor() {
    this._running = null;
    this.paused = null;
    this._unpause = null;
  }

  start() {
    this._running = this.run();
  }

  done() {
    return this._running ? this._running : Promise.resolve();
  }

  async run() {
    try {
      for await (const step of this) {
        behavior_log(step, "info");
        if (this.paused) {
          await this.paused;
        }
      }
      behavior_log(this.getState("done!"), "info");
    } catch (e) {
      behavior_log(this.getState(e), "info");
    }
  }

  pause() {
    if (this.paused) {
      return;
    }
    this.paused = new Promise((resolve) => {
      this._unpause = resolve;
    });
  }

  unpause() {
    if (this._unpause) {
      this._unpause();
      this.paused = null;
      this._unpause = null;
    }
  }

  getState(msg, incrValue) {
    if (incrValue && this.state[incrValue] !== undefined) {
      this.state[incrValue]++;
    }

    return {state: this.state, msg};
  }

  cleanup() {
    
  }
}
