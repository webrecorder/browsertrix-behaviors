import { FacebookTimelineBehavior } from "./facebook";
import { InstagramPostsBehavior } from "./instagram";
import { TelegramBehavior } from "./telegram";
import { TwitterTimelineBehavior } from "./twitter";
import { TikTokVideoBehavior, TikTokProfileBehavior } from "./tiktok";
import { MetaAdsReportDownloadBehavior } from "./meta_ads_report";


const siteBehaviors = [
  InstagramPostsBehavior,
  TwitterTimelineBehavior,
  MetaAdsReportDownloadBehavior,
  FacebookTimelineBehavior,
  TelegramBehavior,
  TikTokVideoBehavior,
  TikTokProfileBehavior

];

export default siteBehaviors;
