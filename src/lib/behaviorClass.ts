/** WIP rewrite of some of the WIP abstract behavior class & types from `behavior.ts` that allows for better autocomplete & typing */

import {
  type waitUntil,
  type sleep,
  type xpathNode,
  type waitUnit,
  type scrollIntoView,
  type RestoreState,
  type xpathString,
  type getState,
  type HistoryState,
  type waitUntilNode,
} from "./utils";

type Opts = {
  maxDepth: number;
};

export interface BehaviorContext<State = {}> {
  Lib: {
    xpathNode: typeof xpathNode;
    sleep: typeof sleep;
    waitUntil: typeof waitUntil;
    waitUnit: typeof waitUnit;
    scrollIntoView: typeof scrollIntoView;
    RestoreState: typeof RestoreState;
    xpathString: typeof xpathString;
    getState: typeof getState;
    HistoryState: typeof HistoryState;
    waitUntilNode: typeof waitUntilNode;
  };
  opts: Opts;
  state?: Partial<State>;
  log: (...args: unknown[]) => void;
}

export abstract class Behavior<State = {}> {
  static readonly id: string;
  abstract run(ctx: BehaviorContext<Partial<State>>): AsyncGenerator;
  showingProgressBar?(ctx: BehaviorContext<State>, root: Node): boolean;
  awaitPageLoad?(ctx: BehaviorContext<State>): Promise<void>;
  // TODO fill more of these in
}
