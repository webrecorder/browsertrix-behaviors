import { Behavior } from "../lib/behavior";
import { sleep, xpathNode, waitUnit, xpathString } from "../lib/utils";


// ===========================================================================
export class TelegramBehavior extends Behavior
{
  static isMatch() {
    return window.location.href.match(/https:\/\/t.me\/s\/\w[\w]+/);
  }

  constructor() {
    super();
    this.telegramContainer = "//main//section[@class='tgme_channel_history js-message_history']";

    this.postId = "string(./div[@data-post]/@data-post)";
    this.linkExternal = "string(.//a[@class='tgme_widget_message_link_preview' and @href]/@href)";
    this.state = {
      messages: 0,
    };
  }

  async waitForPrev(child) {
    if (!child) {
      return null;
    }

    await sleep(waitUnit * 5);

    if (!child.previousElementSibling) {
      return null;
    }

    return child.previousElementSibling;
  }

  async* [Symbol.asyncIterator]() {
    let root = xpathNode(this.telegramContainer);

    if (!root) {
      return;
    }

    let child = root.lastElementChild;

    while (child) {
      child.scrollIntoView(this.scrollOpts);

      const postId = xpathString(this.postId, child) || "unknown";

      const linkUrl = xpathString(this.linkExternal, child);

      if (linkUrl && linkUrl.endsWith(".jpg") || linkUrl.endsWith(".png")) {
        yield this.getState("Loading External Image: " + linkUrl);
        const image = new Image();
        image.src = linkUrl;
        document.body.appendChild(image);
        await sleep(waitUnit * 2.5);
        document.body.removeChild(image);
      }

      yield this.getState("Loading Message: " + postId, "messages");

      child = await this.waitForPrev(child);
    }
  }
}
