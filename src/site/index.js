import { FacebookTimelineBehavior } from "./facebook";
import { InstagramPostsBehavior } from "./instagram";
import { TelegramBehavior } from "./telegram";
import { TwitterTimelineBehavior } from "./twitter";
import { TikTokVideoBehavior } from "./tiktok";

const siteBehaviors = [
  InstagramPostsBehavior,
  TwitterTimelineBehavior,
  FacebookTimelineBehavior,
  TelegramBehavior,
  TikTokVideoBehavior
];

export default siteBehaviors;
