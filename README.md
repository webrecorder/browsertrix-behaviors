# Browsertrix Behaviors

[![Twitter Behavior](https://github.com/webrecorder/browsertrix-behaviors/actions/workflows/twitter.yaml/badge.svg)](https://github.com/webrecorder/browsertrix-behaviors/actions/workflows/twitter.yaml)

[![Autoscroll Behavior](https://github.com/webrecorder/browsertrix-behaviors/actions/workflows/autoscroll.yaml/badge.svg)](https://github.com/webrecorder/browsertrix-behaviors/actions/workflows/autoscroll.yaml)

A set of behaviors injected into the browser to perform certain operations on a page, such as scrolling, fetching additional URLs, or performing
customized actions for social-media sites.

## Usage

The behaviors are compiled into a single file, `dist/behaviors.js`, which can be injected into any modern browser to load the behavior system.
No additional dependencies are required, and the behaviors file can be pasted directly into your browser.

The file can injected in a number of ways, using tools like puppeteer/playwright, a browser extension content script, or even a devtools Snippet, or even a regular
`<script>` tag. Injecting the behaviors into the browser is outside the scope of this repo, but here are a few ways you can try the behaviors:

### Copy & Paste Behaviors (for testing)

To test out the behaviors in your current browser, you can:

1. Go to the [dist/behaviors.js](dist/behaviors.js)
2. Copy the file (it is minified so will be on one line).
3. Open a web page, such as one that has a custom behavior, like: [https://twitter.com/webrecorder_io](https://twitter.com/webrecorder_io)
4. Open devtools console, and paste the script
5. Enter `self.__bx_behaviors.run();`
6. You should see the Twitter page automatically scrolling and visiting tweets.


### Use Puppeteer

To integrate behaviors into an automated workflow, here is an short example using puppeteer.

```javascript
// assumes browsertrix-behaviors is installed as a node module
const behaviors = fs.readFileSync("./node_modules/browsertrix-behaviors/dist/behaviors.js", "utf-8");

await page.evaluateOnNewDocument(behaviors + `
self.__bx_behaviors.init({
  autofetch: true,
  autoplay: true,
  autoscroll: true,
  siteSpecific: true,
});
`);

# call and await run on top frame and all child iframes
await Promise.allSettled(page.frames().map(frame => frame.evaluate("__self.bx_behaviors.run()")));

```


see [Browsertrix Crawler](https://github.com/webrecorder/browsertrix-crawler) for a complete working example of injection using puppeteer.

## Initialization

Once the behavior script has been injected, run: `__bx_behaviors.init(opts)` to initialize which behaviors should be used. `opts` includes several boolean options:

- `autofetch` - enable background autofetching of img srcsets, and stylesheets (when possible)
- `autoplay` - attempt to automatically play and video/audio, or fetch the URLs for any video streams found on the page.
- `autoscroll` - attempt to repeatedly scroll the page to the bottom as far as possible.
- `timeout` - set a timeout (in ms) for all behaviors to finish.
- `siteSpecific` - run a site-specific behavior if available.
- `log` - a function or global string to receive log messages from behaviors

### Background Behaviors

The `autoplay` and `autofetch` are background behaviors, and will run as soon as `init(...)` is called, or as soon as the page is loaded.
Background behaviors do not change the page, but attempt to do additional fetching to ensure more resources are loaded.
Background behaviors can be used with user-directed browsing, and can also be loaded in any iframes on the page.


### Active Behaviors

The `autoscroll` and `siteSpecific` enable 'active' behaviors, modify the page, and run until they are finished or timeout.

If both `siteSpecific` and `autoscroll` is specified, only one behavior is run. If a site-specific behavior exists, it takes precedence over auto-scroll, otherwise, auto-scroll is useed.


Currently, the available site-specific behaviors are available for:

- Twitter
- Instagram

Additional site-specific behaviors can be added to the [site](./src/site) directory.

To run the active behavior, call: `await __bx_behaviors.run()` after init.

Alternatively, calling `await __bx_behaviors.run(opts)` will also call `init(opts)` if init has not been called before.

The promised returned by run will wait for the active behavior to finish, for the `timeout` time to be reached. It will also ensure any pending autoplay requests are started for the `autoplay` behavior.

## Logging

By default, behaviors will log debug messages to `console.log`. To disable this logging, set `log: false` in the init options.

This param can also be set to a custom init function by string. For example, to have behavior event messages be passed to `self.my_log`, set `log: "my_log"` in the options.

Additional logging options may be added soon.

## Building

Browsertrix Behaviors uses webpack to build. Run `yarn run build` to build the latest `dist/behaviors.js`.

Shared utility functions can be added to `utils.js` while site-specific behavior can be added to `lib/site`.
