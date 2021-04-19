import { FacebookTimelineBehavior } from "./facebook";
import { InstagramPostsBehavior } from "./instagram";
import { TwitterTimelineBehavior } from "./twitter";

const siteBehaviors = [
  InstagramPostsBehavior,
  TwitterTimelineBehavior,
  FacebookTimelineBehavior
];

export default siteBehaviors;