import { FacebookTimelineBehavior } from "./facebook";
import { InstagramFeedBehavior, InstagramPostBehavior } from "./instagram";
import { TelegramBehavior } from "./telegram";
import { TwitterTimelineBehavior } from "./twitter";
import { TikTokVideoBehavior, TikTokProfileBehavior } from "./tiktok";
import { YoutubeBehavior } from "./youtube";

const siteBehaviors = [
  InstagramFeedBehavior,
  InstagramPostBehavior,
  TwitterTimelineBehavior,
  FacebookTimelineBehavior,
  TelegramBehavior,
  TikTokVideoBehavior,
  TikTokProfileBehavior,
  YoutubeBehavior
];

export default siteBehaviors;
