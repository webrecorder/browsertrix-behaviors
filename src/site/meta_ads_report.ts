const Q = {
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
export class MetaAdsReportDownloadBehavior {

  static id = "MetaAdsReportDownload";

  isMobile: boolean;

  static isMatch() {
    return !!window.location.href.match(/https:\/\/(www\.)?facebook\.com\/ads\/library\/report/);
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

  async* downloadLastSelectedDays(ctx, selectDays) {
    const {getState, scrollIntoView, scrollAndClick, xpathNode, waitRandom, iterChildMatches} = ctx.Lib;

    const days = ["yesterday", "last7Days",  "last30Days", "last90Days", "allDates"];
    const index = selectDays.match(/\d+/)[0] - 1;
    const selection = days[index];
    yield getState(ctx, "Starting Downloading Ads Report " + selection + " Days");

    const adsReportDownloadButton = xpathNode(Q.adsReportDownload);
    const adsReportChangeTimeSpan = xpathNode(Q.adsReportDownloadTimeSpan);
    if (adsReportChangeTimeSpan) {
      scrollIntoView(adsReportChangeTimeSpan);
      await waitRandom();

      adsReportChangeTimeSpan.click();
      await waitRandom();
      const div_about = xpathNode( Q.adsReportTimeBody );
      const selector = selectDays + "/div/div";
      const item = xpathNode( selector, div_about ) ;

      if (!item ) {
        const itemlist = iterChildMatches(selector, div_about);
        console.log(itemlist);
        console.log(itemlist[index]);
        //const item = itemlist[index];
        console.log("[Error] Ads Report adsReportTimeBody has no selection for " + selection + " Days");
        yield getState(ctx, "Selecting Downloading Ads Report " + selection + " Days failed!");
      }

      await scrollAndClick(item);
      await waitRandom();

      // Mobile Version only -> no Problem if it isn't available, but need to be done in Mobile
      if( this.isMobile ) {
        const adsReportDownloadApply = xpathNode(Q.adsReportDownloadApply);
        if (!adsReportDownloadApply) {
          console.log("[WARNING] Ads Report Change Download Interval Apply Button (Mobile) not found, but isMobile was true");
        } else {
          adsReportDownloadApply.click();
        }
      }

    } else {
      console.log("[Error] Ads Report adsReportChangeTimeSpan to " + selection + " Days NOT matched");
      return;
    }
    await waitRandom();
    adsReportDownloadButton.click();
    await waitRandom();

    yield getState(ctx, "Downloading Ads Report " + selection + " Days", "Downloads");
  }

  async* run(ctx) {
    const {getState, waitRandom} = ctx.Lib;

    const userAgent = navigator.userAgent;
    const regexsMobile = [/(Android)(.+)(Mobile)/i, /BlackBerry/i, /iPhone|iPod/i, /Opera Mini/i, /IEMobile/i];
    if (regexsMobile.some((b) => userAgent.match(b))) {
      this.isMobile = true;
    }
    const regexTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/;
    if(regexTablet.test(userAgent.toLowerCase())){
      this.isMobile = true;
    }

    yield getState(ctx, "Starting with isMobile " + this.isMobile );

    await waitRandom();

    ctx.state = {"Ads": 0, "Downloads": 0};

    yield* this.downloadLastSelectedDays(ctx, Q.adsReportDownloadLastDay);
    await waitRandom();

    yield* this.downloadLastSelectedDays(ctx, Q.adsReportDownloadLast7Days);
    await waitRandom();

    yield* this.downloadLastSelectedDays(ctx, Q.adsReportDownloadLast30Days);
    await waitRandom();

    yield* await this.downloadLastSelectedDays(ctx, Q.adsReportDownloadAllDays);
    await waitRandom();


    yield "Meta Ads Report Download Complete";
  }
}
