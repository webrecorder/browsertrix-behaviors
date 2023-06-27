
const Q = {
  entryTCFEinverstanden: "//*[@id=\"notice\"]/div[3]/div[1]/button",
  classMessageOverlay: ".message-overlay",
};



export const BREADTH_ALL = Symbol("BREADTH_ALL");

export class DerStandardAtTCFBehavior {
  static id = "DerStandardAt_TCF";


  isMobile: boolean;

  static isMatch() {
    return !!window.location.href.match( /https:\/\/www\.derstandard\.at\/consent\/tcf/ );
  }
  static init() {
    return {
      state: {},
      opts: { breadth: BREADTH_ALL }
    };
  }

  constructor() {
    this.isMobile = false;

  }

  async* clickTCFAway(ctx) {
    const {getState, waitRandom, scrollAndClick, xpathNode } = ctx.Lib;

    await waitRandom();

    const entryTPLEinverstanden = xpathNode(Q.entryTCFEinverstanden);

    console.log(entryTPLEinverstanden);

    if ( entryTPLEinverstanden ) {
      yield getState(ctx, "Clicking TCF away, Button found!");
      await scrollAndClick(entryTPLEinverstanden);
      await waitRandom(25, 30);

      const classMessageOverlay = xpathNode(Q.classMessageOverlay);
      if (classMessageOverlay) {
        yield getState(ctx, "ERROR: Button clicked but overlay still exists!");
        return false;
      }
      else {
        yield getState(ctx, "TCF Button clicked and overlay removed", "TCF");
      }
    }
    else {
      yield getState(ctx, "ERROR: Can't click TCF away, Button NOT found!");
      return false;
    }
    return true;

  }

  async* run(ctx) {

    const {getState, waitRandom, xpathNode} = ctx.Lib;

    const userAgent = navigator.userAgent;
    const regexsMobile = [/(Android)(.+)(Mobile)/i, /BlackBerry/i, /iPhone|iPod/i, /Opera Mini/i, /IEMobile/i];
    if (regexsMobile.some((b) => userAgent.match(b))) {
      this.isMobile = true;
    }
    const regexTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/;
    if (regexTablet.test(userAgent.toLowerCase())) {
      this.isMobile = true;
    }

    yield getState(ctx, "Starting with isMobile " + this.isMobile);

    await waitRandom();

    ctx.state = {"TCF": 0 };

    await this.clickTCFAway(ctx);

    const entryTPLEinverstanden = xpathNode(Q.entryTCFEinverstanden);

    if( !entryTPLEinverstanden ) {
      yield getState(ctx, "TCF Overlay clicked away");
    }
    else {
      yield getState(ctx, "ERROR: Aborted due TCF Overlay");
    }
  }
}