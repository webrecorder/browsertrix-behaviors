const Q = {
  pressYes: "//*[@id=\"yes-button\"]",
  pressNo: "//*[@id=\"no-button\"]",
  noAnswer: "//*[@id=\"no-answer-button\"]",
  toTheResult: "/html/body/div/ng-component/div/button",
  restart: "/html/body/div/ng-component/div/div[2]/main/div[10]/div/button[2]",
};

export const BREADTH_ALL = Symbol("BREADTH_ALL");
export class WahlkabineAtBehaviors {

  static id = "WahlkabineAt";

  isMobile: boolean;

  static isMatch() {
    return !!window.location.href.match(/https:\/\/(www\.)?wahlkabine\.at/);
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

  async getRandomWeightXPath( min = 1, max= 9) {
    const factor = Math.floor(Math.random() * (max - min + 1) + min);
    const ret = "//*[@id=\"button-" + factor  +"\"]";
    return ret;
  }

  async* ClickThrewWithButton(ctx, button) {
    const {getState, scrollAndClick, xpathNode, waitRandom } = ctx.Lib;


    yield getState(ctx, "Starting Click Threw Question " + button  );
    let have_button = xpathNode( button ) !== null ? true : false;

    while(have_button)
    {
      const yes_button = xpathNode( button );
      await scrollAndClick(yes_button);
      const importance = await this.getRandomWeightXPath();

      const depth_button = xpathNode( importance );
      await scrollAndClick(depth_button);

      await waitRandom(3,7);

      have_button = xpathNode( button ) !== null ? true : false;
      yield getState(ctx, "Iterate Questions","Questions");

    }
    await waitRandom();

    const toTheResult = xpathNode(Q.toTheResult);
    await scrollAndClick(toTheResult);

    await waitRandom();

    const restart = xpathNode(Q.restart);
    await scrollAndClick(restart);

    await waitRandom();


    yield getState(ctx, "Iterate Questions Done");
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

    yield getState(ctx, "Starting Wahlkabine with isMobile " + this.isMobile );

    await waitRandom();

    const startUrl = window.location.href;

    ctx.state = {"Questions": 0};

    yield* this.ClickThrewWithButton(ctx, Q.pressYes);
    await waitRandom();

    // Should be again at Start URL
    if(window.location.href != startUrl) {
      // Reset to start Url:
      // window.location.href = startUrl;
      // window.location.reload();
      // await waitRandom(5, 10);
      console.log(window.location.href + " was not equal to " + startUrl);
    }
    yield* this.ClickThrewWithButton(ctx, Q.pressNo);
    await waitRandom();

    yield "Wahlkabine Completed";
  }
}
