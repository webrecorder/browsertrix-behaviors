import { xpathNodeDocument } from "../lib/utils";

const Q = {
  adsReportContainer: "//*[@id=\"content\"]/div/div/div/div[2]/div[3]/div/div[9]/div[2]/div/div[2]/div",
  adsReportMessageAdsBlockerOK: "//*[@id=\"facebook\"]/body/div[5]/div[1]/div[1]/div/div/div/div/div[3]/div/div/div/span/div/div/div",
  adsReportLast7Days: "//*[@id=\"content\"]/div/div/div/div[2]/div[3]/div/div[8]/div/div[2]/span/span",
  adsReportLast30Days: "//*[@id=\"content\"]/div/div/div/div[2]/div[3]/div/div[8]/div/div[3]/span/span",
  adsReportLast90Days: "//*[@id=\"content\"]/div/div/div/div[2]/div[3]/div/div[8]/div/div[4]",
  adsReportAllDates: "//*[@id=\"content\"]/div/div/div/div[2]/div[3]/div/div[8]/div/div[5]",
  adsReportPaginationNext: "//*[@id=\"content\"]/div/div/div/div[2]/div[3]/div/div[9]/div[2]/div/div[3]/div[2]/div/div/button[2]",
  adsReportSortingAmount: "//*[@id=\"content\"]/div/div/div/div[2]/div[3]/div/div[9]/div[2]/div/div[2]/div/div[1]/div/div[4]/div/span/i",
  adsReportSortingCounter: "//*[@id=\"content\"]/div/div/div/div[2]/div[3]/div/div[9]/div[2]/div/div[2]/div/div[1]/div/div[5]/div/span/i",
  searchForAdvertiser: "//*[@id=\"content\"]/div/div/div/div[2]/div[2]/div/div[4]/div[2]/div[2]/div[1]/div/div[1]/div/div[1]/input",
  newWindowAllAdsContainer: "//*[@id=\"content\"]/div/div/div/div[6]/div[2]",
  openAdsDetailsCurrentSibling: "div[2]/div[4]/div[1]",
  //*[@id="content"]/div/div/div/div[6]/div[2]/div[2]/div[4]/div[1]
  openAdsDetailsPreviousSibling: "div[3]/div[3]/div[1]",
  //*[@id=\"content\"]/div/div/div/div[6]/div[2]/div[2]/div[4]/div[1]/div[1]/div/div[2]/div/span/div/div/div",
  openAdsDetailsSibling: "div[1]",
  openAdsDetailsLocator: "div/div[2]/div/span/div/div/div",
  backButton: "//*[@id=\"facebook\"]/body/div[8]/div[2]/div/div/div/div/div/div/div[1]/div",
  footerElementDetails: "div[contains(@class, \"x1sy10c2 xqmxbcd xieb3on xmupa6y x1dr75xp xh8yej3\")]",
  footerElement: "//*[@id=\"js_2lc\"]",
  rootPath: "//*[@id=\"content\"]/div/div",
  //*[@id="content"]/div/div/div/div[6]/div[3]/div/div[2]/div/div/span
};
export const BREADTH_ALL = Symbol("BREADTH_ALL");

export class MetaAdsLibaryBehavior {

  extraWindow: any;

  static id = "MetaAdsLibary";

  static isMatch() {
    return !!window.location.href.match( /https:\/\/(www\.)?facebook\.com\/ads\/library\/report/);
  }

  static init() {
    return {
      state: {},
      opts: { breadth: BREADTH_ALL }
    };
  }

  constructor() {
    this.extraWindow = null;
  }

  async* iterAdsFromList(ctx) {
    const {getState, iterChildMatches, scrollAndClick, waitUnit, waitRandom, xpathNode} = ctx.Lib;
    const adsListNextButton = xpathNode(Q.adsReportPaginationNext);
    if (!adsListNextButton) {
      console.log("[ERROR] Ads Next Button not found", adsListNextButton);
      return;
    }
    //console.log("[LOG] Ads Report Pagignation Next Button", adsListNextButton);
    let break_loop = false;
    while (!break_loop)
    {
      const adsListNextButton = xpathNode(Q.adsReportPaginationNext);
      // Check on Class for end of pagination
      let classnames = adsListNextButton.getAttribute("class");
      if (classnames.indexOf("x1h6gzvc") > -1 )
      {
        break_loop=true;
        console.log("[LOG] Ads Next Button Iteration Break");
      }

      let container = xpathNode(Q.adsReportContainer);
      const adsList = iterChildMatches("a", container);
      for await (const item of adsList) {
        await waitRandom();
        const href = item.getAttribute("href");
        // Wenn nicht neues Window aufgeht endet behavior Script sofort!
        await this.openNewWindow(ctx, href);

        await waitRandom(5 , 30);
        yield getState(ctx, `Viewing extra ${href}`);
        await waitRandom(500, 2000);
        console.log("Scroll infinity");
        await this.infScrollAds(ctx, this.extraWindow.document);

        const container = xpathNodeDocument(Q.newWindowAllAdsContainer, this.extraWindow.document);
        await waitRandom();
        if(!container) {
          console.log("Get Container Failed");
          continue;
        }
        await waitRandom();

        const current_item_container = xpathNodeDocument(Q.openAdsDetailsCurrentSibling, this.extraWindow.document, container);
        if (current_item_container) {
          console.log("Get XPATH Items Current Dir:");
          console.dir(current_item_container);

          const items_current_list = iterChildMatches(Q.openAdsDetailsSibling, current_item_container);
          for await (const item of items_current_list) {
            if (item) {
              yield* this.adsDetailsCrawlThread(ctx, item);
            }
            else {
              console.log("Error: Item was null");
            }
          }
        }
        else {
          console.log("Get XPATH Items Current Failed");
          console.dir(current_item_container);
        }
        const previous_item_container = xpathNodeDocument(Q.openAdsDetailsPreviousSibling, this.extraWindow.document, container);
        if (previous_item_container) {
          console.log("Get XPATH Items Previous Dir:");
          console.dir(previous_item_container);
          const items_prev_list = iterChildMatches(Q.openAdsDetailsSibling, previous_item_container);
          for await (const item of items_prev_list) {
            if (item) {
              yield* this.adsDetailsCrawlThread(ctx, item);
            }
            else {
              console.log("Error: Item was null");
            }
          }
        }
        else {
          console.log("Get XPATH Items Previous Failed");
          console.dir(previous_item_container);
        }

        this.extraWindow.blur();
        window.focus();
      }
      this.extraWindow.close();

      if(!break_loop) {
        await waitRandom();
        await scrollAndClick(adsListNextButton, waitUnit);
        await waitRandom();
      }
    }
  }

  async* infScrollAds(ctx, doc) {
    const {getState} = ctx.Lib;

    yield getState(ctx, "Starting Scrolling down for ${doc}");

    const MAXIMUM_NUMBER_OF_TRIALS = 5;

    let currentScrollHeight = 0;
    let manualStop = false;
    let numberOfScrolls = 0;
    let numberOfTrials = 0;

    while (numberOfTrials < MAXIMUM_NUMBER_OF_TRIALS && !manualStop) {
      // Keep the current scroll height
      currentScrollHeight = doc.body.scrollHeight;

      // Scroll at the bottom of the page
      window.scrollTo(0, currentScrollHeight);

      yield getState(ctx, `Scrolled to ${currentScrollHeight}`);


      // Wait some seconds to load more results

      await ctx.waitRandom( 500 , 2000);


      // If the height hasn't changed, there may be no more results to load
      if (currentScrollHeight === this.extraWindow.document.body.scrollHeight) {
        // Try another time
        numberOfTrials++;

        console.log(
          `Is it already the end of the infinite scroll? ${MAXIMUM_NUMBER_OF_TRIALS - numberOfTrials} trials left.`,
        );
      } else {
        // Restart the number of consecutive trials
        numberOfTrials = 0;

        // Increment the number of successful scroll
        numberOfScrolls++;

        console.log(`The scroll ${numberOfScrolls} was successful!`);
      }
    }

    console.log("We should be at the bottom of the infinity scroll! Congratulation!");
    console.log(`${numberOfScrolls} scrolls were needed to load all results!`);

    yield getState(ctx, "Scrolled down finished");
  }

  async* adsDetailsCrawlThread(ctx, item ) {
    const {scrollAndClick,iterChildMatches,waitRandom, getState} = ctx.Lib;
    await this.infScrollAds(ctx, this.extraWindow.document);
    const item_localized = xpathNodeDocument(Q.openAdsDetailsLocator, this.extraWindow.document, item);
    console.dir(item_localized);
    const btext = item_localized.innerText || item_localized.textContent;
    console.log("Button Text: " + btext);
    await waitRandom( 5, 30);
    if (!item_localized) {
      console.log("Not Found next " + item_localized + " adsDetailsCrawlThread");
      return;
    }
    await waitRandom( 5, 30);
    await scrollAndClick(item_localized, 500);
    await waitRandom( 5, 25);
    yield getState(ctx, "View more Ads", "Ads");
    await waitRandom( );
    // TODO: Hier können noch Sub Element sein!
    const container = xpathNodeDocument(Q.newWindowAllAdsContainer, this.extraWindow.document);
    const previous_item_container = xpathNodeDocument(Q.openAdsDetailsPreviousSibling, this.extraWindow.document, container);
    if (previous_item_container) {
      console.log("Get XPATH Items Previous Dir:");
      console.dir(previous_item_container);
      const items_prev_list = iterChildMatches(Q.openAdsDetailsSibling, previous_item_container);
      yield this.adsCrawlThread(ctx,items_prev_list, 0);
    }
    const backButton = xpathNodeDocument(Q.backButton, this.extraWindow.document);
    console.log("Debug Back Button Element");
    console.dir(backButton);
    if(backButton) {
      await scrollAndClick(backButton, 500);
    }
    else {
      this.extraWindow.history.back();
    }
    await waitRandom( 5, 30);
  }
  async* adsCrawlThread(ctx, items_list, iter = 0) {
    const {scrollAndClick, waitUntil, waitUnit, waitRandom, getState} = ctx.Lib;
    await waitRandom( 5, 30);
    const item_current = items_list[iter];
    if (!item_current) {
      console.log("Not Found next " + item_current + " Crawl Thread");
      return;
    }
    yield getState(ctx, "Starting View More Ads " + item_current);
    console.dir(item_current);
    const ad_item_cur_located = xpathNodeDocument(Q.openAdsDetailsLocator, this.extraWindow.document, item_current);
    yield getState(ctx, "Starting View More Ads Localized " + ad_item_cur_located);

    console.dir(ad_item_cur_located);
    let lastHref = this.extraWindow.location.href;
    await waitRandom( 5, 30);
    await scrollAndClick(ad_item_cur_located, 500);
    await waitRandom( 5, 25);
    await waitUntil(() => this.extraWindow.location.href !== lastHref, waitUnit * 2);
    yield getState(ctx, "View more Ads", "Ads");
    await waitRandom();
    this.extraWindow.location.href = lastHref;
    await waitRandom( 30, 50);
    yield* this.adsCrawlThread(ctx, items_list, iter + 1);
  }

  async openNewWindow(ctx, url) {
    if (!this.extraWindow) {
      this.extraWindow = await ctx.Lib.openWindow(url);
    }
    else {
      this.extraWindow.location.href = url;
    }
    await ctx.Lib.awaitLoad();

    window.blur();
    this.extraWindow.focus();
  }

  async changeListSorting(ctx, elem)
  {
    console.log("[LOG] Ads Report changeListSorting");
    const { scrollIntoView, sleep, waitUnit, xpathNode } = ctx.Lib;
    const filterElem = xpathNode(elem);
    if(filterElem) {
      scrollIntoView(filterElem);
      await sleep(waitUnit * 5);
    }
    else {
      console.log("[ERROR] Ads Report changeListSorting Element XPath: " + elem + " not found ");
      return;
    }
    filterElem.click();
    await sleep(waitUnit * 5);
    // TODO: ITer List!
    await this.iterAdsFromList(ctx);

    console.log("[LOG] Ads Report changeListSorting done");
  }

  async* run(ctx) {
    const { getState, sleep } = ctx.Lib;

    yield getState(ctx, "Starting...");

    await sleep(2000);

    ctx.state = { "Ads": 0, "Downloads": 0 };

    yield* await this.iterAdsFromList(ctx);

    //yield* this.downloadAdsReport(ctx);
    //yield* this.downloadLastSelectedDays(ctx, Q.adsReportDownloadLast7Days);
    //yield* this.downloadLastSelectedDays(ctx, Q.adsReportDownloadLast30Days);


    yield "Meta Ads Libary Behavior Complete";
  }
}
