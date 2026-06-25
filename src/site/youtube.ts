import { type AbstractBehavior, type Context } from "../lib/behavior";

type YoutubeState = {};

export class YoutubeBehavior implements AbstractBehavior<YoutubeState> {
  static id = "Youtube" as const;

  static init() {
    return {
      state: {},
    };
  }

  static isMatch() {
    return !!window.location.href.match(/^https:\/\/(www\.)?youtube(-nocookie)?\.com\//);
  }

  static onPageInit() {
    // Attempt to induce YouTube into serving up older video formats
    Object.defineProperty(MediaSource, "isTypeSupported", {
      value: () => false,
      configurable: false,
      writable: false,
    });
  }

  async *run(_ctx: Context<YoutubeState>) {}

  async awaitPageLoad(ctx: Context<YoutubeState>) {
    const { sleep, assertContentValid } = ctx.Lib;
    await sleep(10);
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
