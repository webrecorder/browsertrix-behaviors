# Browsertrix Behaviors

A set of behaviors injected into the browser to perform certain operations on a page, such as scrolling, fetching additional URLs, or performing
customized actions for social-media sites.

## Usage

The behaviors are designed to be compiled into a single file, `dist/behaviors.js`, which can be injected into any modern browser to load the behavior system.

The file can injected in a number of ways, using tools like puppeteer/playwright, a browser extension content script, or even a devtools Snippet, or even a regular
`<script>` tag. Injecting the behaviors into the browser is outside the scope of this repo, but here is one way it can be done with puppeteer/playwright:

```javascript

await page.evaluateOnNewDocument(behaviors + `
self.__wb_behaviors.init({
  autofetch: true,
  autoplay: true,
  autoscroll: true,
  siteSpecific: true,
  timeout: 30000,
});
`);

# call and await run on top frame and all child iframes
await Promise.allSettled(page.frames().map(frame => frame.evaluate("__self.wb_behaviors.run()")));

```

see [Browsertrix Crawler](https://github.com/webrecorder/browsertrix-crawler) for a complete working example of injection using puppeteer.

## Initialization

Once the behavior script has been injected, run: `__wb_behaviors.init(opts)` to initialize which behaviors should be used. `opts` includes several boolean options:

- `autofetch` - enable background autofetching of img srcsets, and stylesheets (when possible)
- `autoplay` - attempt to automatically play and video/audio, or fetch the URLs for any video streams found on the page.
- `autoscroll` - attempt to repeatedly scroll the page to the bottom as far as possible.
- `timeout` - set a timeout (in ms) for all behaviors to finish.
- `siteSpecific` - run a site-specific behavior if available.

### Background Behaviors

The `autoplay` and `autofetch` are background behaviors, and will run as soon as `init(...)` is called, or as soon as the page is loaded.
Background behaviors do not change the page, but attempt to do additional fetching to ensure more resources are loaded.
Background behaviors can be used with user-directed browsing, and can also be loaded in any iframes on the page.


### Active Behaviors

The `autoscroll` and `siteSpecific` enable 'active' behaviors, modify the page, and run until they are finished or timeout.

If both `siteSpecific` and `autoscroll` is specified, only one behavior is run. If a site-specific behavior exists, it takes precedence over auto-scroll, otherwise, auto-scroll is useed.


Currently, the available site-specific behavior are for:

- Twitter
- Instagram

Additional site-specific behaviors can be added to the [site](./src/site) directory.

To run the active behavior, call: `await __wb_behaviors.run()` after init.

The promised returned by run will wait for the active behavior to finish, for the `timeout` time to be reached. It will also ensure any pending autoplay requests are started for the `autoplay` behavior.

## Building

Browsertrix Behaviors uses webpack to build. Run `yarn run build` to build the latest `dist/behaviors.js`.

Shared utility functions can be added to `utils.js` while site-specific behavior can be added to `lib/site`.
