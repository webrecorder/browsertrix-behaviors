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
} from "./lib/utils";

type Opts = {
  maxDepth: number;
};

export interface Context<State = {}> {
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
  abstract run(ctx: Context<Partial<State>>): AsyncGenerator;
  showingProgressBar?(ctx: Context<State>, root: Node): boolean;
  awaitPageLoad?(ctx: Context<State>): Promise<void>;
}
