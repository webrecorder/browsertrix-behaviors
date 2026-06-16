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
    return !!window.location.href.match(/https:\/\/(www\.)?youtube\.com\//);
  }

  async *run(ctx: Context<YoutubeState>) {
    const { getState } = ctx.Lib;

    // Attempt to induce YouTube into serving up older video formats
    yield getState(ctx, "Setting MediaSourc.isTypeSupported to return false");
    Object.defineProperty(MediaSource, "isTypeSupported", {
      value: () => false,
      configurable: false,
      writable: false,
    });

    yield getState(ctx, "Overriding canPlayType to return false for av01");
    const canPlayType = HTMLMediaElement.prototype.canPlayType;
    Object.defineProperty(HTMLMediaElement.prototype, "canPlayType", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: (type: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (/av01/.test(type)) {
          return "";
        } else {
          return canPlayType.call(this, type);
        }
      },
      configurable: false,
      writable: false,
    });

    yield getState(
      ctx,
      "Overriding MediaCapabilities.decodingInfo() to mark av01 not supported",
    );
    const decodingInfo = navigator.mediaCapabilities.decodingInfo;
    Object.defineProperty(navigator.mediaCapabilities, "decodingInfo", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: async (configuration: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (
          configuration.video &&
          /av01/.test(configuration.video.contentType)
        ) {
          return { supported: false, smooth: false, powerEfficient: false };
        } else {
          return decodingInfo.call(this, configuration);
        }
      },
      configurable: false,
      writable: false,
    });
  }

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
