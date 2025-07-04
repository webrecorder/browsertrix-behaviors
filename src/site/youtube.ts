import { AutoScroll } from "../autoscroll";

export class YoutubeBehavior extends AutoScroll {
  override async awaitPageLoad(ctx: any) {
    const { sleep, assertContentValid } = ctx.Lib;
    await sleep(10);
    assertContentValid(() => {
      const video = document.querySelector("video");
      const paused = video && video.paused;
      if (paused) {
        return false;
      }
      return document.documentElement.outerHTML.indexOf("not a bot") === -1;
    }, "no_video_playing");
  }
}
