import { AutoScroll } from "../autoscroll";
import { type Context } from "../lib/behavior";

export class YoutubeBehavior extends AutoScroll {
  static override id = "Youtube" as const;
  async awaitPageLoad(ctx: Context<{}, {}>) {
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
