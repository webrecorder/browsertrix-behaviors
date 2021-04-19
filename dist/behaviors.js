/*! behaviors.js is part of Webrecorder project. Copyright (C) 2021, Webrecorder Software. Licensed under the Affero General Public License v3. */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/autofetcher.js":
/*!****************************!*\
  !*** ./src/autofetcher.js ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AutoFetcher": () => (/* binding */ AutoFetcher)
/* harmony export */ });
/* harmony import */ var _lib_behavior__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./lib/behavior */ "./src/lib/behavior.js");
/* harmony import */ var _lib_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./lib/utils */ "./src/lib/utils.js");
// AutoFetcher script
// extract and fetch all urls from srcsets, from images as well as audio/video
// also extract any urls from media query stylesheets that have not necessarily been loaded
// (May not work for cross-origin stylesheets)




const SRC_SET_SELECTOR = "img[srcset], img[data-srcset], img[data-src], " +  
"video[srcset], video[data-srcset], video[data-src], audio[srcset], audio[data-srcset], audio[data-src], " +
"picture > source[srcset], picture > source[data-srcset], picture > source[data-src], " +
"video > source[srcset], video > source[data-srcset], video > source[data-src], " +
"audio > source[srcset], audio > source[data-srcset], audio > source[data-src]";

const SRCSET_REGEX = /\s*(\S*\s+[\d.]+[wx]),|(?:\s*,(?:\s+|(?=https?:)))/;

const STYLE_REGEX = /(url\s*\(\s*[\\"']*)([^)'"]+)([\\"']*\s*\))/gi;
const IMPORT_REGEX = /(@import\s*[\\"']*)([^)'";]+)([\\"']*\s*;?)/gi;


// ===========================================================================
class AutoFetcher extends _lib_behavior__WEBPACK_IMPORTED_MODULE_0__.BackgroundBehavior
{
  constructor() {
    super();
    this.urlSet = new Set();
    this.urlqueue = [];
    this.numPending = 0;
    this.start();
  }

  async start() {
    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.awaitLoad)();
    this.run();
    this.initObserver();
  }

  done() {
    //TODO:
    return Promise.resolve();
  }

  async run() {
    this.extractSrcSrcSetAll(document);
    this.extractStyleSheets();
  }

  isValidUrl(url) {
    return url && (url.startsWith("http:") || url.startsWith("https:"));
  }

  queueUrl(url) {
    try {
      url = new URL(url, document.baseURI).href;
    } catch (e) {
      return;
    }

    if (!this.isValidUrl(url)) {
      return;
    }

    if (this.urlSet.has(url)) {
      return;
    }

    this.urlSet.add(url);

    this.doFetch(url);
  }

  async doFetch(url) {
    this.urlqueue.push(url);
    if (this.numPending <= 6) {
      while (this.urlqueue.length > 0) {
        const url = this.urlqueue.shift();
        try {
          this.numPending++;
          this.debug("AutoFetching: " + url);
          const resp = await fetch(url);
          await resp.blob();
        } catch (e) {
          this.debug(e);
        }
        this.numPending--;
      }
    }
  }

  initObserver() {
    this.mutobz = new MutationObserver((changes) => this.observeChange(changes));

    this.mutobz.observe(document.documentElement, {
      characterData: false,
      characterDataOldValue: false,
      attributes: true,
      attributeOldValue: true,
      subtree: true,
      childList: true,
      attributeFilter: ["srcset"]
    });
  }

  processChangedNode(target) {
    switch (target.nodeType) {
    case Node.ATTRIBUTE_NODE:
      if (target.nodeName === "srcset") {
        this.extractSrcSetAttr(target.nodeValue);
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

    const src = elem.src || elem.getAttribute("data-src");

    if (src) {
      this.queueUrl(src);
    }

    const srcset = elem.srcset || elem.getAttribute("data-srcset");

    if (srcset) {
      this.extractSrcSetAttr(srcset);
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

  extractStyleSheets(root) {
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



/***/ }),

/***/ "./src/autoplay.js":
/*!*************************!*\
  !*** ./src/autoplay.js ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Autoplay": () => (/* binding */ Autoplay)
/* harmony export */ });
/* harmony import */ var _lib_behavior__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./lib/behavior */ "./src/lib/behavior.js");
/* harmony import */ var _lib_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./lib/utils */ "./src/lib/utils.js");




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
class Autoplay extends _lib_behavior__WEBPACK_IMPORTED_MODULE_0__.BackgroundBehavior {
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
    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.awaitLoad)();
    this.initObserver();
    //await this.checkAutoPlayRedirect();

    for (const [, elem] of document.querySelectorAll("video, audio").entries()) {
      this.addMediaWait(elem);
    }

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(1000);

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



/***/ }),

/***/ "./src/autoscroll.js":
/*!***************************!*\
  !*** ./src/autoscroll.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AutoScroll": () => (/* binding */ AutoScroll)
/* harmony export */ });
/* harmony import */ var _lib_behavior__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./lib/behavior */ "./src/lib/behavior.js");
/* harmony import */ var _lib_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./lib/utils */ "./src/lib/utils.js");




// ===========================================================================
class AutoScroll extends _lib_behavior__WEBPACK_IMPORTED_MODULE_0__.Behavior
{
  constructor() {
    super();
    this.showMoreQuery = "//*[contains(text(), 'show more') or contains(text(), 'Show more')]";
  
    this.state = {
      segments: 1
    };
  }

  static get name() {
    return "Autoscroll";
  }

  async* [Symbol.asyncIterator]() {
    const canScrollMore = () =>
      self.scrollY + self.innerHeight <
      Math.max(
        self.document.body.scrollHeight,
        self.document.body.offsetHeight,
        self.document.documentElement.clientHeight,
        self.document.documentElement.scrollHeight,
        self.document.documentElement.offsetHeight
      );

    const scrollOpts = { top: 200, left: 0, behavior: "auto" };
    const interval = _lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit;

    //scrollOpts.top = Math.min(self.document.body.clientHeight * 0.01, 500);

    let showMoreElem = null;
    let origHeight = self.document.body.clientHeight;

    while (canScrollMore()) {
      if (self.document.body.clientHeight > origHeight) {
        this.state.segments++;
      }

      origHeight = self.document.body.clientHeight;

      if (!showMoreElem) {
        showMoreElem = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.showMoreQuery);
      }

      if (showMoreElem && (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.isInViewport)(showMoreElem)) {
        yield this.getState("Clicking 'Show More', awaiting more content");
        showMoreElem.click();

        await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit);

        await Promise.race([
          (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUntil)(() => self.document.body.clientHeight > origHeight, 500),
          (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(30000)
        ]);

        showMoreElem = null;
      }

      self.scrollBy(scrollOpts);

      yield this.getState(`Scrolling down by ${scrollOpts.top} pixels every ${interval / 1000.0} seconds`);
      
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(interval);
      
      // check for scrolling, but allow for more time for content to appear the longer have already scrolled
      await Promise.race([
        (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUntil)(() => canScrollMore(), interval),
        (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(this.state.segments * 5000)
      ]);
    }
  }
}


/***/ }),

/***/ "./src/lib/behavior.js":
/*!*****************************!*\
  !*** ./src/lib/behavior.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BackgroundBehavior": () => (/* binding */ BackgroundBehavior),
/* harmony export */   "Behavior": () => (/* binding */ Behavior)
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils */ "./src/lib/utils.js");



// ===========================================================================
class BackgroundBehavior
{
  debug(msg) {
    (0,_utils__WEBPACK_IMPORTED_MODULE_0__.behaviorLog)(msg, "debug");
  }

  log(msg) {
    (0,_utils__WEBPACK_IMPORTED_MODULE_0__.behaviorLog)(msg, "info");
  }
}

// ===========================================================================
class Behavior extends BackgroundBehavior
{
  constructor() {
    super();
    this._running = null;
    this.paused = null;
    this._unpause = null;
    this.state = {};

    this.scrollOpts = {behavior: "smooth", block: "center", inline: "center"};
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
        this.log(step);
        if (this.paused) {
          await this.paused;
        }
      }
      this.log(this.getState("done!"));
    } catch (e) {
      this.log(this.getState(e));
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

/***/ }),

/***/ "./src/lib/utils.js":
/*!**************************!*\
  !*** ./src/lib/utils.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "waitUnit": () => (/* binding */ waitUnit),
/* harmony export */   "sleep": () => (/* binding */ sleep),
/* harmony export */   "waitUntil": () => (/* binding */ waitUntil),
/* harmony export */   "awaitLoad": () => (/* binding */ awaitLoad),
/* harmony export */   "behaviorLog": () => (/* binding */ behaviorLog),
/* harmony export */   "openWindow": () => (/* binding */ openWindow),
/* harmony export */   "_setLogFunc": () => (/* binding */ _setLogFunc),
/* harmony export */   "_setBehaviorManager": () => (/* binding */ _setBehaviorManager),
/* harmony export */   "installBehaviors": () => (/* binding */ installBehaviors),
/* harmony export */   "RestoreState": () => (/* binding */ RestoreState),
/* harmony export */   "HistoryState": () => (/* binding */ HistoryState),
/* harmony export */   "xpathNode": () => (/* binding */ xpathNode),
/* harmony export */   "xpathNodes": () => (/* binding */ xpathNodes),
/* harmony export */   "xpathString": () => (/* binding */ xpathString),
/* harmony export */   "iterChildElem": () => (/* binding */ iterChildElem),
/* harmony export */   "isInViewport": () => (/* binding */ isInViewport)
/* harmony export */ });
let _logFunc = console.log;
let _behaviorMgrClass = null;

const waitUnit = 200;

function sleep(timeout) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

async function waitUntil(pred, timeout) {
  while (!pred()) {
    await sleep(timeout);
  }
}

function awaitLoad() {
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

function behaviorLog(data, type = "debug") {
  if (_logFunc) {
    callBinding(_logFunc, {data, type});
  }
}

async function openWindow(url) {
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

function _setLogFunc(func) {
  _logFunc = func;
}

function _setBehaviorManager(cls) {
  _behaviorMgrClass = cls;
}

function installBehaviors(obj) {
  obj.__bx_behaviors = new _behaviorMgrClass();
}

// ===========================================================================
class RestoreState {
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
class HistoryState {
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
function xpathNode(path, root) {
  root = root || document;
  return document.evaluate(path, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue;
}

function* xpathNodes(path, root) {
  root = root || document;
  let iter = document.evaluate(path, root, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
  let result = null;
  while ((result = iter.iterateNext()) !== null) {
    yield result;
  }
}

function xpathString(path, root) {
  root = root || document;
  return document.evaluate(path, root, null, XPathResult.STRING_TYPE).stringValue;
}

async function* iterChildElem(root, timeout, totalTimeout) {
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


// ===========================================================================
function isInViewport(elem) {
  var bounding = elem.getBoundingClientRect();
  return (
    bounding.top >= 0 &&
      bounding.left >= 0 &&
      bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}


/***/ }),

/***/ "./src/site/facebook.js":
/*!******************************!*\
  !*** ./src/site/facebook.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FacebookTimelineBehavior": () => (/* binding */ FacebookTimelineBehavior)
/* harmony export */ });
/* harmony import */ var _lib_behavior__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/behavior */ "./src/lib/behavior.js");
/* harmony import */ var _lib_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/utils */ "./src/lib/utils.js");




// ===========================================================================
class FacebookTimelineBehavior extends _lib_behavior__WEBPACK_IMPORTED_MODULE_0__.Behavior
{
  static isMatch() {
    return window.location.href.match(/https:\/\/(www\.)?facebook\.com\//);
  }

  static get name() {
    return "Facebook";
  }

  constructor() {
    super();
    this.feedQuery = "//div[@role='feed']";
    this.articleQuery = ".//div[@role='article']";
    this.pageletPostList = "//div[@data-pagelet='page']/div[@role='main']//div[@role='main']/div";
    this.pageletProfilePostList = "//div[@data-pagelet='page']//div[@data-pagelet='ProfileTimeline']";

    this.photosOrVideosQuery = `.//a[(contains(@href, '/photos/') or contains(@href, '/photo/?') or contains(@href, '/videos/')) and (starts-with(@href, '${window.location.origin}/') or starts-with(@href, '/'))]`;
  
    this.extraLabel = "//*[starts-with(text(), '+')]";
    this.nextSlideQuery = "//div[@data-name='media-viewer-nav-container']/div[@data-visualcompletion][2]//div[@role='button']";

    this.closeButtonQuery = "//div[@aria-hidden='false']//div[@role='button' and not(@aria-hidden) and @aria-label]";

    this.commentListQuery = ".//ul[(../h3) or (../h4)]";
    this.commentMoreReplies = "./div[2]/div[1]/div[2]/div[@role='button']";
    this.commentMoreComments = "./following-sibling::div/div/div[2][@role='button'][./span/span]";

    this.viewCommentsQuery = ".//h4/..//div[@role='button']";

    this.photoCommentListQuery = "//ul[../h2]";

    this.isPhotoVideoPage = /^.*facebook\.com\/[^/]+\/(photos|videos)/;

    this.extraWindow = null;

    //todo: make option
    this.allowNewWindow = false;

    this.state = {
      posts: 0,
      comments: 0,
      photos: 0,
      videos: 0,
    };
  }

  async* [Symbol.asyncIterator]() {
    if (this.isPhotoVideoPage.exec(window.location.href)) {
      const root = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.photoCommentListQuery);
      yield* this.iterComments(root);
      return;
    }

    const feeds = Array.from((0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNodes)(this.feedQuery));
    if (feeds && feeds.length) {
      for (const feed of feeds) {
        for await (const post of (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.iterChildElem)(feed, _lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit, _lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUntil * 10)) {
          yield* this.viewPost((0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.articleQuery, post));
        }
      }
    } else {
      const feed = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.pageletPostList) || (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.pageletProfilePostList);
      for await (const post of (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.iterChildElem)(feed, _lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit, _lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUntil * 10)) {
        yield* this.viewPost((0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.articleQuery, post));
      }
    }

    if (this.extraWindow) {
      this.extraWindow.close();
    }
  }

  async* viewPost(post) {
    if (!post) {
      return;
    }
    yield this.getState("Viewing post", "posts");

    post.scrollIntoView(this.scrollOpts);
    
    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2);

    yield* this.viewPhotosOrVideos(post);
    
    let commentRootUL = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.commentListQuery, post);
    if (!commentRootUL) {
      const viewCommentsButton = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.viewCommentsQuery, post);
      if (viewCommentsButton) {
        viewCommentsButton.click();
        await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2);
      }
      commentRootUL = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.commentListQuery, post);
    }
    yield* this.iterComments(commentRootUL);

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);
  }

  async* viewPhotosOrVideos(post) {
    const objects = Array.from((0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNodes)(this.photosOrVideosQuery, post));

    const objHrefs = new Set();
    let count = 0;
    
    for (const obj of objects) {
      const url = new URL(obj.href, window.location.href);
      if (obj.href.indexOf("?fbid") === -1) {
        url.search = "";
      }

      if (objHrefs.has(url.href)) {
        continue;
      }

      const type = obj.href.indexOf("/video") >= 0 ? "videos" : "photos";

      ++count;

      objHrefs.add(url.href);

      yield this.getState(`Viewing ${type} ${url.href}`, type);

      obj.scrollIntoView();

      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 3);

      obj.click();

      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 20);
      //await sleep(10000);

      if (this.allowNewWindow) {
        await this.openNewWindow(url.href);
      }

      if (count === objects.length) {
        yield* this.viewExtraObjects(obj, type, this.allowNewWindow);
      }

      const close = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.closeButtonQuery);

      if (close) {
        close.click();
        await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2);
      }
    }
  }

  async* viewExtraObjects(obj, type, openNew) {
    const extraLabel = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.extraLabel, obj);

    if (!extraLabel) {
      return;
    }

    const num = Number(extraLabel.innerText.slice(1));
    if (isNaN(num)) {
      return;
    }

    let lastHref;

    for (let i = 0; i < num; i++) {
      const nextSlideButton = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.nextSlideQuery);

      if (!nextSlideButton) {
        continue;
      }

      lastHref = window.location.href;

      nextSlideButton.click();
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);

      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUntil)(() => window.location.href !== lastHref, _lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2);

      yield this.getState(`Viewing extra ${type} ${window.location.href}`);

      if (openNew) {
        await this.openNewWindow(window.location.href);
      }
    }
  }

  async openNewWindow(url) {
    if (!this.extraWindow) {
      this.extraWindow = await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.openWindow)(url);
    } else {
      this.extraWindow.location.href = url;
    }
  }

  async* iterComments(commentRootUL) {
    if (!commentRootUL) {
      return;
    }
    let commentBlock = commentRootUL.firstElementChild;
    let lastBlock = null;

    while (commentBlock) {
      while (commentBlock) {
        yield this.getState("Loading comments", "comments");
        commentBlock.scrollIntoView(this.scrollOpts);

        const moreReplies = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.commentMoreReplies, commentBlock);
        if (moreReplies) {
          moreReplies.click();
          await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);
        }

        lastBlock = commentBlock;
        commentBlock = lastBlock.nextElementSibling;
      }

      let moreButton = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.commentMoreComments, commentRootUL);
      if (moreButton) {
        moreButton.scrollIntoView(this.scrollOpts);
        moreButton.click();
        await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);
        if (lastBlock) {
          commentBlock = lastBlock.nextElementSibling;
        }
      }
    }
  }
}

/***/ }),

/***/ "./src/site/index.js":
/*!***************************!*\
  !*** ./src/site/index.js ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _facebook__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./facebook */ "./src/site/facebook.js");
/* harmony import */ var _instagram__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./instagram */ "./src/site/instagram.js");
/* harmony import */ var _twitter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./twitter */ "./src/site/twitter.js");




const siteBehaviors = [
  _instagram__WEBPACK_IMPORTED_MODULE_1__.InstagramPostsBehavior,
  _twitter__WEBPACK_IMPORTED_MODULE_2__.TwitterTimelineBehavior,
  _facebook__WEBPACK_IMPORTED_MODULE_0__.FacebookTimelineBehavior
];

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (siteBehaviors);

/***/ }),

/***/ "./src/site/instagram.js":
/*!*******************************!*\
  !*** ./src/site/instagram.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "InstagramPostsBehavior": () => (/* binding */ InstagramPostsBehavior)
/* harmony export */ });
/* harmony import */ var _lib_behavior__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/behavior */ "./src/lib/behavior.js");
/* harmony import */ var _lib_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/utils */ "./src/lib/utils.js");

//import { behavior_log, installBehaviors } from "../lib/utils";



// ===========================================================================
class InstagramPostsBehavior extends _lib_behavior__WEBPACK_IMPORTED_MODULE_0__.Behavior
{
  static isMatch() {
    return window.location.href.match(/https:\/\/(www\.)?instagram\.com\/\w[\w]+/);
  }

  static get name() {
    return "Instagram";
  }

  constructor() {
    super();
    this.state = {};
        
    this.rootPath = "//article/div/div";
    this.childMatchSelect = "string(.//a[starts-with(@href, '/')]/@href)";
    this.childMatch = "child::div[.//a[@href='$1']]";

    this.firstPostInRow = "div[1]/a";
    //this.postCloseButton = "//button[.//*[@aria-label=\"Close\"]]";
    this.postCloseButton = "/html/body/div[last()]/div[3]/button[.//*[@aria-label]]";

    //this.nextPost = "//div[@role='dialog']//a[text()='Next']";
    this.nextPost = "//div[@role='dialog']//a[contains(@class, 'coreSpriteRightPaginationArrow')]";
    this.postLoading = "//*[@aria-label='Loading...']";

    this.subpostNextOnlyChevron = "//article[@role='presentation']//div[@role='presentation']/following-sibling::button";
    this.subpostPrevNextChevron = this.subpostNextOnlyChevron + "[2]";

    this.commentRoot = "//article/div[3]/div[1]/ul";

    //this.viewReplies = "li//button[span[contains(text(), 'View replies')]]";
    this.viewReplies = "//li//button[span[not(count(*)) and text()!='$1']]";
    //this.loadMore = "//button[span[@aria-label='Load more comments']]";
    this.loadMore = "//button[span[@aria-label]]";

    this.maxCommentsTime = 10000;

    // extra window for first post, if allowed
    this.postOnlyWindow = null;

    this.state = {
      posts: 0,
      slides: 0,
      rows: 0,
      comments: 0,
    };
  }

  cleanup() {
    if (this.postOnlyWindow) {
      this.postOnlyWindow.close();
      this.postOnlyWindow = null;
    }
  }

  async waitForNext(child) {
    if (!child) {
      return null;
    }

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit);

    if (!child.nextElementSibling) {
      return null;
    }

    //     while (xpathNode(this.progressQuery, child.nextElementSibling)) {
    //       await sleep(100);
    //     }

    return child.nextElementSibling;
  }

  async* iterRow() {
    let root = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.rootPath);

    if (!root) {
      return;
    }

    let child = root.firstElementChild;

    if (!child) {
      return;
    }

    while (child) {
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit);

      const restorer = new _lib_utils__WEBPACK_IMPORTED_MODULE_1__.RestoreState(this.childMatchSelect, child);

      if (restorer.matchValue) {
        yield child;

        child = await restorer.restore(this.rootPath, this.childMatch);
      }

      child = await this.waitForNext(child);
    }
  }

  async* viewStandalonePost(origLoc) {
    let root = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.rootPath);

    if (!root || !root.firstElementChild) {
      return;
    }

    const firstPostHref = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathString)(this.childMatchSelect, root.firstElementChild);

    yield this.getState("Loading single post view for first post: " + firstPostHref);

    // const separateWindow = false;

    // if (separateWindow) {
    //   try {
    //     this.postOnlyWindow = window.open(firstPostHref, "_blank", "resizable");

    //     installBehaviors(this.postOnlyWindow);

    //     this.postOnlyWindow.__bx_behaviors.run({autofetch: true});

    //     await sleep(waitUnit * 10);
  
    //   } catch (e) {
    //     behavior_log(e);
    //   }
    // } else {

    window.history.replaceState({}, "", firstPostHref);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));

    let root2 = null;
    let root3 = null;

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUntil)(() => (root2 = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.rootPath)) !== root && root2, _lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);

    window.history.replaceState({}, "", origLoc);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUntil)(() => (root3 = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.rootPath)) !== root2 && root3, _lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);
    //}
  }

  async *iterSubposts() {
    let next = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.subpostNextOnlyChevron);

    let count = 1;

    while (next) {
      next.click();
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);

      yield this.getState(`Loading Slide ${++count} for ${window.location.href}`, "slides");

      next = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.subpostPrevNextChevron);
    }

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);
  }

  async iterComments() {
    const root = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.commentRoot);

    if (!root) {
      return;
    }

    let child = root.firstElementChild;

    let commentsLoaded = false;

    let text = "";

    while (child) {
      child.scrollIntoView(this.scrollOpts);

      commentsLoaded = true;

      let viewReplies = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.viewReplies.replace("$1", text), child);

      while (viewReplies) {
        const orig = viewReplies.textContent;
        viewReplies.click();
        this.state.comments++;
        await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2.5);

        await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUntil)(() => orig !== viewReplies.textContent, _lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit);

        text = viewReplies.textContent;
        viewReplies = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.viewReplies.replace("$1", text), child);
      }

      if (child.nextElementSibling && child.nextElementSibling.tagName === "LI" && !child.nextElementSibling.nextElementSibling) {
        let loadMore = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.loadMore, child.nextElementSibling);
        if (loadMore) {
          loadMore.click();
          this.state.comments++;
          await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);
        } 
      }

      child = child.nextElementSibling;
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2.5);
    }

    return commentsLoaded;
  }

  async* iterPosts(next) {
    let count = 0;
    
    while (next && ++count <= 3) {
      next.click();
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 10);

      yield this.getState("Loading Post: " + window.location.href, "posts");

      await fetch(window.location.href);

      yield* this.iterSubposts();

      yield this.getState("Loaded Comments", "comments");

      await Promise.race([
        this.iterComments(),
        (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(this.maxCommentsTime)
      ]);

      next = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.nextPost);

      while (!next && (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.postLoading)) {
        await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2.5);
      }
    }

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);
  }

  async* [Symbol.asyncIterator]() {
    const origLoc = window.location.href;

    for await (const row of this.iterRow()) {
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2.5);

      const first = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.firstPostInRow, row);

      first.click();
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 10);

      break;
    }

    yield* this.viewStandalonePost(origLoc);

    for await (const row of this.iterRow()) {
      row.scrollIntoView(this.scrollOpts);

      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2.5);

      yield this.getState("Loading Row", "rows");

      const first = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.firstPostInRow, row);

      yield* this.iterPosts(first);

      const close = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.postCloseButton);
      if (close) {
        close.click();
      }

      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);
    }
  }
}


/***/ }),

/***/ "./src/site/twitter.js":
/*!*****************************!*\
  !*** ./src/site/twitter.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TwitterTimelineBehavior": () => (/* binding */ TwitterTimelineBehavior)
/* harmony export */ });
/* harmony import */ var _lib_behavior__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/behavior */ "./src/lib/behavior.js");
/* harmony import */ var _lib_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/utils */ "./src/lib/utils.js");




// ===========================================================================
class TwitterTimelineBehavior extends _lib_behavior__WEBPACK_IMPORTED_MODULE_0__.Behavior
{
  static isMatch() {
    return window.location.href.match(/https:\/\/(www\.)?twitter\.com\//);
  }

  static get name() {
    return "Twitter";
  }

  constructor(maxDepth = 0) {
    super();
    this.maxDepth = maxDepth || 0;

    //this.rootPath = "//div[starts-with(@aria-label, 'Timeline')]/*[1]";
    this.rootPath = "//h1[@role='heading' and @aria-level='1']/following-sibling::div[@aria-label]/*[1]";
    this.anchorQuery = ".//article";
    this.childMatchSelect = "string(.//article//a[starts-with(@href, '/') and @aria-label]/@href)";
    this.childMatch = "child::div[.//a[@href='$1']]";

    //this.expandQuery = ".//div[@role='button' and @aria-haspopup='false']//*[contains(text(), 'more repl')]";
    this.expandQuery = ".//div[@role='button' and not(@aria-haspopup) and not(@data-testid)]";
    this.quoteQuery = ".//div[@role='blockquote' and @aria-haspopup='false']";

    this.imageQuery = ".//a[@role='link' and starts-with(@href, '/') and contains(@href, '/photo/')]";
    //this.imageNextQuery = "//div[@aria-label='Next slide']";
    this.imageFirstNextQuery = "//div[@aria-roledescription='carousel']/div[2]/div[1]/div[@role='button']";
    this.imageNextQuery = "//div[@aria-roledescription='carousel']/div[2]/div[2]/div[@role='button']";
    //this.imageCloseQuery = "//div[@aria-label='Close' and @role='button']";
    this.imageCloseQuery = "//div[@role='presentation']/div[@role='button' and @aria-label]";
    //this.backButtonQuery = "//div[@aria-label='Back' and @role='button']";
    this.backButtonQuery = "//div[@data-testid='titleContainer']//div[@role='button']";

    this.progressQuery = ".//*[@role='progressbar']";

    //this.promoted = ".//*[text()=\"Promoted\"]";
    this.promoted = ".//div[data-testid='placementTracking']";

    this.seenTweets = new Set();
    this.seenMediaTweets = new Set();

    this.state = {
      tweets: 0,
      images: 0,
      videos: 0,
      //threads: 0,
    };
  }

  async waitForNext(child) {
    if (!child) {
      return null;
    }

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2);

    if (!child.nextElementSibling) {
      return null;
    }

    while ((0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.progressQuery, child.nextElementSibling)) {
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit);
    }

    return child.nextElementSibling;
  }

  async expandMore(child) {
    const expandElem = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.expandQuery, child);
    if (!expandElem) {
      return child;
    }

    const prev = child.previousElementSibling;
    expandElem.click();
    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit);
    while ((0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.progressQuery, prev.nextElementSibling)) {
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit);
    }
    child = prev.nextElementSibling;
    return child;
  }

  async* infScroll() {
    let root = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.rootPath);

    if (!root) {
      return;
    }

    let child = root.firstElementChild;

    if (!child) {
      return;
    }

    while (child) {
      let anchorElem = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.anchorQuery, child);

      if (!anchorElem && this.expandQuery) {
        child = await this.expandMore(child, this.expandQuery, this.progressQuery);
        anchorElem = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.anchorQuery, child);
      }

      if (child && child.innerText) {
        child.scrollIntoView(this.scrollOpts);      
      }

      if (child && anchorElem) {
        await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit);

        const restorer = new _lib_utils__WEBPACK_IMPORTED_MODULE_1__.RestoreState(this.childMatchSelect, child);

        if (restorer.matchValue) {
          yield anchorElem;

          child = await restorer.restore(this.rootPath, this.childMatch);
        }
      }

      child = await this.waitForNext(child, this.progressQuery);
    }
  }

  async* mediaPlaying(tweet) {
    const media = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)("(.//video | .//audio)", tweet);
    if (!media || media.paused) {
      return;
    }

    let msg = "Waiting for media playback";

    try {
      const mediaTweetUrl = new URL((0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathString)(this.childMatchSelect, tweet.parentElement), window.location.origin).href;
      if (this.seenMediaTweets.has(mediaTweetUrl)) {
        return;
      }
      msg += " for " + mediaTweetUrl;
      this.seenMediaTweets.add(mediaTweetUrl);
    } catch (e) {
      console.warn(e);
    }

    msg += " to finish...";

    yield this.getState(msg, "videos");

    const p = new Promise((resolve) => {
      media.addEventListener("ended", () => resolve());
      media.addEventListener("abort", () => resolve());
      media.addEventListener("error", () => resolve());
      media.addEventListener("pause", () => resolve());
    });

    await Promise.race([p, (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(60000)]);
  }

  async* iterTimeline(depth = 0) {
    if (this.seenTweets.has(window.location.href)) {
      return;
    }

    yield this.getState("Capturing thread: " + window.location.href, "threads");

    // iterate over infinite scroll of tweets
    for await (const tweet of this.infScroll()) {
      // skip promoted tweets
      if ((0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.promoted, tweet)) {
        continue;
      }

      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2.5);

      // process images
      yield* this.clickImages(tweet, depth);

      // process quoted tweet
      const quoteTweet = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.quoteQuery, tweet);

      if (quoteTweet) {
        yield* this.clickTweet(quoteTweet, 1000);
      }

      // await any video or audio
      yield* this.mediaPlaying(tweet);


      // track location to see if click goes to new url
      yield* this.clickTweet(tweet, depth);

      // wait before continuing
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);
    }
  }

  async* clickImages(tweet) {
    const imagePopup = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.imageQuery, tweet);

    if (imagePopup) {
      const imageState = new _lib_utils__WEBPACK_IMPORTED_MODULE_1__.HistoryState(() => imagePopup.click());

      yield this.getState("Loading Image: " + window.location.href, "images");

      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);

      let nextImage = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.imageFirstNextQuery);
      let prevLocation = window.location.href;

      while (nextImage) {
        nextImage.click();
        await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2);

        if (window.location.href === prevLocation) {
          await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);
          break;
        }
        prevLocation = window.location.href;

        yield this.getState("Loading Image: " + window.location.href, "images");
        await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 5);

        nextImage = (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.xpathNode)(this.imageNextQuery);
      }

      await imageState.goBack(this.imageCloseQuery);
    }
  }

  async* clickTweet(tweet, depth) {
    const tweetState = new _lib_utils__WEBPACK_IMPORTED_MODULE_1__.HistoryState(() => tweet.click());

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit);

    if (tweetState.changed) {
      yield this.getState("Capturing Tweet: " + window.location.href, "tweets");

      if (depth < this.maxDepth && !this.seenTweets.has(window.location.href)) {
        yield* this.iterTimeline(depth + 1, this.maxDepth);
      }

      this.seenTweets.add(window.location.href);

      // wait
      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit * 2);

      await tweetState.goBack(this.backButtonQuery);

      await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(_lib_utils__WEBPACK_IMPORTED_MODULE_1__.waitUnit);
    }
  }

  async* [Symbol.asyncIterator]() {
    yield* this.iterTimeline(0);
  }
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BehaviorManager": () => (/* binding */ BehaviorManager)
/* harmony export */ });
/* harmony import */ var _autofetcher__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./autofetcher */ "./src/autofetcher.js");
/* harmony import */ var _autoplay__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./autoplay */ "./src/autoplay.js");
/* harmony import */ var _autoscroll__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./autoscroll */ "./src/autoscroll.js");
/* harmony import */ var _lib_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./lib/utils */ "./src/lib/utils.js");
/* harmony import */ var _site__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./site */ "./src/site/index.js");








// ===========================================================================
class BehaviorManager
{
  constructor() {
    this.behaviors = [];
    this.mainBehavior = null;
    this.inited = false;
    this.started = false;
    (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.behaviorLog)("Loaded behaviors for: " + self.location.href);
  }

  init(opts = {autofetch: true, autoplay: true, autoscroll: true, siteSpecific: true}) {
    if (this.inited) {
      return;
    }

    this.inited = true;

    if (!self.window) {
      return;
    }

    this.timeout = opts.timeout;

    // default if omitted is 'console.log'
    if (opts.log !== undefined) {
      let logger = opts.log;
      // if string, look up as global
      if (typeof(logger) === "string") {
        logger = self[logger];
      }
      // if function, set to it
      if (typeof(logger) === "function") {
        (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__._setLogFunc)(logger);
      // if false, disable logging
      } else if (logger === false) {
        (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__._setLogFunc)(null);
      }
    }

    if (opts.autofetch) {
      (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.behaviorLog)("Enable AutoFetcher");
      this.behaviors.push(new _autofetcher__WEBPACK_IMPORTED_MODULE_0__.AutoFetcher());
    }

    if (opts.autoplay) {
      (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.behaviorLog)("Enable Autoplay");
      this.behaviors.push(new _autoplay__WEBPACK_IMPORTED_MODULE_1__.Autoplay());
    }

    let siteMatch = false;

    if (self.window.top !== self.window) {
      return;
    }

    if (opts.siteSpecific) {
      for (const siteBehaviorClass of _site__WEBPACK_IMPORTED_MODULE_4__.default) {
        if (siteBehaviorClass.isMatch()) {
          (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.behaviorLog)("Starting Site-Specific Behavior: " + siteBehaviorClass.name);
          this.mainBehaviorClass = siteBehaviorClass;
          this.mainBehavior = new siteBehaviorClass();
          siteMatch = true;
          break;
        }
      }
    } 

    if (!siteMatch && opts.autoscroll) {
      (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.behaviorLog)("Starting Autoscroll");
      this.mainBehaviorClass = _autoscroll__WEBPACK_IMPORTED_MODULE_2__.AutoScroll;
      this.mainBehavior = new _autoscroll__WEBPACK_IMPORTED_MODULE_2__.AutoScroll();
    }

    if (this.mainBehavior)  {
      this.behaviors.push(this.mainBehavior);

      return this.mainBehavior.name;
    }

    return "";
  }

  async run(opts) {
    if (this.started) {
      this.unpause();
      return;
    }

    this.init(opts);

    await (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.awaitLoad)();

    if (this.mainBehavior) {
      this.mainBehavior.start();
    }

    this.started = true;

    let allBehaviors = Promise.allSettled(this.behaviors.map(x => x.done()));

    if (this.timeout) {
      (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.behaviorLog)(`Waiting for behaviors to finish or ${this.timeout}ms timeout`);
      allBehaviors = Promise.race([allBehaviors, (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.sleep)(this.timeout)]);
    } else {
      (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.behaviorLog)("Waiting for behaviors to finish");
    }

    await allBehaviors;
    (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.behaviorLog)("All Behaviors Done!");

    if (this.mainBehavior && this.mainBehaviorClass.cleanup) {
      this.mainBehavior.cleanup();
    }
  }

  pause() {
    (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.behaviorLog)("Pausing Main Behavior" + this.mainBehaviorClass.name);
    if (this.mainBehavior) {
      this.mainBehavior.pause();
    }
  }

  unpause() {
    (0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.behaviorLog)("Unpausing Main Behavior: " + this.mainBehaviorClass.name);
    if (this.mainBehavior) {
      this.mainBehavior.unpause();
    }
  }
}

(0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__._setBehaviorManager)(BehaviorManager);

(0,_lib_utils__WEBPACK_IMPORTED_MODULE_3__.installBehaviors)(self);

})();

/******/ })()
;
//# sourceMappingURL=behaviors.js.map