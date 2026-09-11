import { type AbstractBehavior, type Context } from "../lib/behavior";
import { getState } from "../lib/utils";

type YoutubeState = {};

export class YoutubeBehavior implements AbstractBehavior<YoutubeState> {
  static id = "Youtube" as const;

  static runInIframe = true;

  static init() {
    return {
      state: {},
    };
  }

  static isMatch() {
    return !!window.location.href.match(
      /^https:\/\/(www\.)?youtube(-nocookie)?\.com\//,
    );
  }

  static onPageInit() {
    // Attempt to induce YouTube into serving up older video formats
    Object.defineProperty(MediaSource, "isTypeSupported", {
      value: () => false,
      configurable: false,
      writable: false,
    });
  }

  async *run(ctx: Context<YoutubeState>) {
    if (window !== top && window.location.href.indexOf("/embed/") > 0) {
      // if iframe embed, just ensure that we wait for the video also
      // since awaitPageLoad is not called for iframes
      const { waitUntilNode, waitUnit } = ctx.Lib;

      yield getState(ctx, "Waiting for YT video element");

      await waitUntilNode("//video", document, null, 10 * waitUnit * 5);
    }
  }

  async awaitPageLoad(ctx: Context<YoutubeState>) {
    const { assertContentValid, waitUntilNode, waitUnit } = ctx.Lib;

    await waitUntilNode("//video", document, null, 10 * waitUnit * 5);

    assertContentValid(() => {
      const video = document.querySelector("video");
      const paused = video?.paused;
      if (paused) {
        return false;
      }
      return document.documentElement.outerHTML.indexOf("not a bot") === -1;
    }, "no_video_playing");
  }
}
