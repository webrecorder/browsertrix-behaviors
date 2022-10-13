import { XPath, Behavior } from "../lib/dsl";

// Queries

const CommentListContainer = (q: XPath) =>
  q.descendant("div").where(q.attr("class").contains("CommentListContainer"));

const CommentItemContainer = (q: XPath) =>
  q.descendant("div").where(q.attr("class").contains("CommentItemContainer"));

const ViewMoreReplies = (q: XPath) =>
  q.descendant("p").where(q.attr("class").contains("ReplyActionText"));

const ViewMoreThread = (q: XPath) =>
  q.descendant("p").where(q.attr("data-e2e").startsWith("view-more"));

// Behaviors

const viewThread = (bx: Behavior) =>
  bx.scrollIntoView()
    .yield("View thread", "threads");

const expandThread = (bx: Behavior) =>
  bx.findOne(ViewMoreReplies, { timeout: 1000 })
    .yield("Expand thread", "expandedThreads")
    .scrollIntoView()
    .wait(500)
    .click();

const crawlThread = (bx: Behavior) =>
  bx.findOne(ViewMoreThread, { timeout: 1000 })
    .yield("View more replies", "replies")
    .scrollIntoView()
    .wait(500)
    .click()
    .chain(crawlThread);

export default (bx: Behavior) =>
  bx.findOne(CommentListContainer)
    .yield("Iterating Commentlist")
    .iterateMatches(
      CommentItemContainer,
      (bx: Behavior) => bx.chain(viewThread, expandThread, crawlThread),
      { waitForMore: 2000 }
    );
