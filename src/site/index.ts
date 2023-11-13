import { FacebookTimelineBehavior } from "./facebook";
import { InstagramPostsBehavior } from "./instagram";
import { TelegramBehavior } from "./telegram";
import { TwitterTimelineBehavior } from "./twitter";
import { TikTokVideoBehavior, TikTokProfileBehavior } from "./tiktok";
import { MetaAdsReportDownloadBehavior } from "./meta_ads_report";
import {BskyTimelineBehavior} from "./bsky";

const siteBehaviors = [
  MetaAdsReportDownloadBehavior,
  InstagramPostsBehavior,
  TwitterTimelineBehavior,
  FacebookTimelineBehavior,
  BskyTimelineBehavior,
  TelegramBehavior,
  TikTokVideoBehavior,
  TikTokProfileBehavior,
];

export default siteBehaviors;
