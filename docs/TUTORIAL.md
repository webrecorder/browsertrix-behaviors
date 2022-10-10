# Browsertrix Behaviors Tutorial

This is an introduction to writing new behaviors for the Browsertrix crawler
and extension. Behaviors range from a variety of usecases, such as automatically
scrolling through the page to load more content, clicking through UI elements
that open pop-ups, modals, and sidebars– or performing specific actions on
social media sites or other non-conventional websites, specifically Single Page
Applications (SPAs).

# Writing a TikTok Video Behavior

We're going to write a TikTok video behavior that scrolls through and expands
each comment thread.

## 🏗  Scaffolding

To create a new behavior, we first create a new file in the `src/site/`
directory. This will define a JavaScript module that extends the `Behavior`
class as well as a `Symbol.asyncIterator` function that acts as the "entry" to
the behavior's actions.

We'll name our file `tiktok.js` and add the basic elements needed to define
our behavior:

```javascript
/* src/site/tiktok.js */
import { Behavior } from "../lib/behavior";

class TikTokVideoBehavior extends Behavior {
  constructor() {
    super();
  }

  async* [Symbol.asyncIterator]() {
    yield "TikTok Video Behavior Complete";
  }
}
```

The next step we need to take is to include our new behavior into the
`src/site/index.js` module, like so:

```javascript
/* Other video behaviors */
import { TikTokVideoBehavior } from "./tiktok";

const siteBehaviors = [
  /* Other video behaviors */
  TikTokVideoBehavior,
];

export default siteBehaviors;
```

### The `isMatch()` method

Next we define an `isMatch` method for our `TikTokVideoBehavior` class. This
method checks whether the behavior should run on the current page. Let's use a
regular expression to match against the current path:

```javascript
class TikTokVideoBehavior extends Behavior {
  // ...
  static isMatch() {
    const pathRegex = /https:\/\/(www\.)?tiktok\.com\/@.+\/video\/\d+/;
    return window.location.href.match(pathRegex);
  }
}
```

Note that the `isMatch` method is `static`, meaning it is defined on the class
itself. When this function returns true, our code in the `Symbol.asyncIterator`
method will run.

### Finding each comment thread

We're now ready to run behaviors on TikTok video pages. browsertrix-behaviors
relies on [XPath][xpath] queries to find DOM nodes and interact with them.
After looking through the page's HTML, you'll see that the comment threads all
live inside an element whose classname corresponds with its element type
followed by `CommentListContainer`.

[xpath]: https://www.w3schools.com/xml/xpath_intro.asp

An XPath query that looks for `div` elements with a similar class, looks
something like this:

```
//div[contains(@class, 'CommentListContainer')]
```

Let's define a constant to reference these queries:

```javascript
const Q = {
  commentListContainer: "//div[contains(@class, 'CommentListContainer')]",
}
```

In order to find an element via XPath, we import a function from the
`src/lib/utils.js` module:

Next, we expand the `Symbol.asyncIterator` method like so:

```javascript
class TikTokVideoBehavior extends Behavior {
  // ...
  async* [Symbol.asyncIterator]() {
    const commentList = xpathNode(Q.commentListContainer);
    console.log("[LOG] List Container", commentList);
    yield "TikTok Video Behavior Complete";
  }
}
```

For now we're just logging out the result returned by the query.

## 🏁 Checkpoint: Testing our code so far

Let's test the pieces we've built so far in the browser. At this point your
`src/site/tiktok.js` module should look something like this:

```javascript
import { Behavior } from "../lib/behavior";
import { xpathNode } from "../lib/utils";

const Q = {
  commentListContainer: "//div[contains(@class, 'CommentListContainer')]"
};

export const BREADTH_ALL = Symbol("BREADTH_ALL");

export class TikTokVideoBehavior extends Behavior {
  static get name() {
    return "TikTokVideo";
  }

  static isMatch() {
    const pathRegex = /https:\/\/(www\.)?tiktok\.com\/@.+\/video\/\d+/;
    return window.location.href.match(pathRegex);
  }

  constructor() {
    super();
  }

  async* [Symbol.asyncIterator]() {
    const commentList = xpathNode(Q.commentListContainer);
    console.log("[LOG] List Container", commentList);
    yield "TikTok Video Behavior Complete";
  }
}
```

We'll build what we have so far via the `build-dev` script defined in
`package.json`. Make sure you have `yarn` installed as well as the project's
dependencies by running:

```
$ npm install -g yarn
$ yarn install
```

Next, we build our behaviors in development mode:

```
$ yarn run build-dev
```

This will compile and output our behaviors into `dist/behaviors.js`. We can
copy this code and run it in our browser to test behaviors directly. Make sure
you're viewing a [TikTok Video][tiktok-video], and we can test our code in
Chrome for example by following these steps:

[tiktok-video]: https://www.tiktok.com/@webbstyles/video/7143026261693123882

1. Open the Developer Tools
1. Click the `Sources` tab
1. In the left sidebar, open the `Snippets` tab
1. Click the `+ New Snippet` button
1. Build the development output via `yarn run build-dev`
1. Copy the output from `dist/index.js`
    - Running `cat dist/index.js | pbcopy` on Linux/MacOS will copy the contents to your clipboard.
1. Paste the contents in the new Snippet
1. At the bottom of the window click the "Play" button or press `Ctrl/Cmd+Enter`

Our code is now loaded into the browser, and we can interact with it directly.
In order to run our new behvaior, open the `Console` tab in the Developer Tools
and run the following code:

```javascript
self.__bx_behaviors.run({
  autofetch: false,
  autoplay: false,
  autoscroll: false,
  siteSpecific: true
});
```

A few outputs should appear in your console that look like the following:

```
> {data: 'Starting Site-Specific Behavior: TikTokVideo', type: 'debug'}
> [LOG] List Container <div class="tiktok-...-DivCommentListContainer ...">…</div>
> {data: 'Waiting for behaviors to finish', type: 'debug'}
> {data: 'TikTok Video Behavior Complete', type: 'info'}
> {data: {state: {}, msg: 'done!'}, type: 'info'}
> {data: 'All Behaviors Done for https://www.tiktok.com/@webbstyles/video/7143026261693123882', type: 'debug'}
```
