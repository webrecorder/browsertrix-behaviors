const Q = {
  entryTPLEinverstanden: "//*[contains(text(), 'EINVERSTANDEN') or contains(text(), 'Einverstanden')]",
  entryTPLTitle: "//*[title=\"Einverstanden\"]",
  entryTPLButtonTitle: "//button[title=\"Einverstanden\"]",
  entryTPLXPath: "//*[@id=\"notice\"]/div[3]/div[1]/button",
  iFrameButton: "//iframe/preceding-sibling::button",
  //messageDiv: "//*[@id=\"sp_message_container_759155\"]",
  messageDiv: "//*[@id=\"sp_message_iframe_759155\"]",
  anyButton: "//button",
  anyIFrame: "//iframe",
  classMessageOverlay: "//*[@class=\"message-overlay\"]",
};


export const BREADTH_ALL = Symbol("BREADTH_ALL");

export class DerStandardAtBehavior {
  static id = "DerStandardAt";


  isMobile: boolean;

  static isMatch() {
    return !!window.location.href.match( /https:\/\/(www\.)?derstandard\.at/ );
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

  haveButtons( ctx ) {
    const { xpathNode } = ctx.Lib;
    for (let key in Q) {
      let selector = Q[key];
      const searchElem = xpathNode( selector );
      if (searchElem) {
        console.log(searchElem);
        return searchElem;

      }
      console.log(selector + " and key " + key + " was not found in page");
    }
    return false;
  }

  async* clickTPLAway(ctx) {
    const {getState, waitRandom, xpathNode  } = ctx.Lib;
    yield getState(ctx, "Clicking TPL away, Starting");

    await waitRandom();

    const parent_element = xpathNode(Q.messageDiv); //this.haveButtons( ctx );

    if (parent_element) {
      console.log(parent_element);
      yield getState(ctx, "Clicking TPL away, Button found!");
      const btnEin = xpathNode("/html" , parent_element);
      console.log(btnEin);
      btnEin["click"]();
      await waitRandom(25, 30);
      const classMessageOverlay = xpathNode(Q.classMessageOverlay, parent_element);
      if (classMessageOverlay) {
        yield getState(ctx, "ERROR: Button clicked but overlay still exists!");
        return false;
      } else {
        yield getState(ctx, "TPL Button clicked and overlay removed", "TPL");
      }

      /*
      const entryTPLEinverstanden = xpathNode(selector);
      console.log(entryTPLEinverstanden);

      if(!entryTPLEinverstanden) {
        const buttons = Array.from(xpathNodes(selector));
        console.log(buttons);
        buttons.forEach(function ( value ) {
          console.log(value);
        });
      }


      if (entryTPLEinverstanden) {
        yield getState(ctx, "Clicking TPL away, Button found!");
        await scrollAndClick(entryTPLEinverstanden);
        await waitRandom(25, 30);
        const classMessageOverlay = xpathNode(Q.classMessageOverlay);
        if (classMessageOverlay) {
          yield getState(ctx, "ERROR: Button clicked but overlay still exists!");
          return false;
        } else {
          yield getState(ctx, "TPL Button clicked and overlay removed", "TPL");
        }
      } else {
        yield getState(ctx, "ERROR: Can't click TPL away, Button NOT found!");
        return false;
      }

       */

    }
    return true;

  }

  async* run(ctx) {

    const {getState, waitRandom} = ctx.Lib;

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

    ctx.state = {"TPL": 0, "Articles": 0 , "Comments" : 0 };

    let tpl_away = yield* await this.clickTPLAway(ctx);
    if( tpl_away ) {
      const url_res = await fetch( "https://www.derstandard.at" );
      console.log(url_res);
    }
    else {
      yield getState(ctx, "ERROR: Aborted due TPL Overlay");

    }

  }

}