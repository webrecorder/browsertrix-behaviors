import {getState, sleep, xpathString} from "../lib/utils";

const Q = {
  orfMain: "//main[@id=\"content\"]",
  orfVideosDivClass: "div[contains(@class, 'videolane-item')]",
  orfVideosPlayButtonClass: "*[contains(@class, 'videolane-huge-play-button')]",
  orfEmbedVideoClass: "div[contains(@class, 'oonmedia-video-container')]",
  orfEmbedVideoPlayClass: "//button[contains(@class, 'bmpui-ui-playbacktogglebutton')]",
  orfEmbedVideoLength: "//span[contains(@class, 'bmpui-text-right')]",

  adsReportDownloadTimeSpan: "//*[@id=\"ReportDownload\"]/div/div/div/div/div[1]/div[2]/div/div[2]/div[1]/div[2]/div/span/div/div/div[2]/div",
  adsReportTimeBody: "/html/body/div[5]/div[1]/div[1]/div/div/div[1]/div[2]/div",
  adsReportDownloadLastDay: "div[1]",
  adsReportDownloadLast7Days: "div[2]",
  adsReportDownloadLast30Days: "div[3]",
  adsReportDownloadAllDays: "div[5]",
  adsReportDownloadApply: "//*[@id=\"facebook\"]/body/div[5]/div[2]/div[3]/div/div[2]/div/span/div/div/div",
  adsReportDownload: "//*[@id=\"ReportDownload\"]/div/div/div/div/div[1]/div[2]/div/div[2]/div[4]/a",
};

export const BREADTH_ALL = Symbol("BREADTH_ALL");
export class NewsOrfClickVideosBehavior {

  static id = "NewsOrfClickVideos";

  isMobile: boolean;

  static isMatch() {
    return !!window.location.href.match(/https:\/\/(www\.)?orf\.at/);
  }

  static init() {
    return {
      state: {},
      opts: {breadth: BREADTH_ALL}
    };
  }

  constructor() {
    this.isMobile = false;
  }

  async* clickAllOrfVideos(ctx) {
    const {getState, xpathString, scrollAndClick, xpathNode, waitRandom, iterChildMatches} = ctx.Lib;

    yield getState(ctx, "Starting Clicking ORF Videos");

    const orfMain = xpathNode(Q.orfMain);

    // Videos of Newsroom
    const videoItems = iterChildMatches(Q.orfVideosDivClass, orfMain);
    for await (const video of videoItems) {
      console.log(video);
      const video_button = xpathNode(Q.orfVideosPlayButtonClass, video);
      console.log(video_button);
      await scrollAndClick(video_button);
      yield getState(ctx, "View Video", "Videos");

    }

    // Videos in Articles
    const embedVideoItems = iterChildMatches(Q.orfEmbedVideoClass, orfMain);
    for await (const video of embedVideoItems) {
      console.log(video);
      const video_button = xpathNode(Q.orfEmbedVideoPlayClass, video);
      if (video_button != null) {
        await scrollAndClick(video_button);
        await waitRandom();
        yield getState(ctx, "Video started", "Videos");
        const video_length = xpathString(Q.orfEmbedVideoLength, video);
        const time = video_length.split(":");
        var wait = time[0] * 60;
        wait += time[1];
        await sleep(wait * 1000);

        yield getState(ctx, "Video awaited, continue");
      }


    }


    yield getState(ctx, "Click ORF Videos Complete");

  }

  async* run(ctx) {
    const {getState, waitRandom, isMobile} = ctx.Lib;

    this.isMobile = isMobile();

    yield getState(ctx, "Starting bahviors ONB with isMobile " + this.isMobile );

    await waitRandom();

    ctx.state = {"Videos": 0};

    yield* this.clickAllOrfVideos(ctx);
    await waitRandom();


    yield "ORF Videos Click Complete";
  }
}
