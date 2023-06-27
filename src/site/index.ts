import { FacebookTimelineBehavior } from "./facebook";
import { InstagramPostsBehavior } from "./instagram";
import { TelegramBehavior } from "./telegram";
import { TwitterTimelineBehavior } from "./twitter";
import { TikTokVideoBehavior, TikTokProfileBehavior } from "./tiktok";
import { MetaAdsReportDownloadBehavior } from "./meta_ads_report";
import { MetaAdsLibaryBehavior } from "./meta_ads";
import { DerStandardAtBehavior } from "./derstandard_at";

const siteBehaviors = [

  MetaAdsReportDownloadBehavior,
  InstagramPostsBehavior,
  TwitterTimelineBehavior,
  FacebookTimelineBehavior,
  TelegramBehavior,
  TikTokVideoBehavior,
  TikTokProfileBehavior,
  DerStandardAtBehavior,
  MetaAdsLibaryBehavior,
];

export default siteBehaviors;
