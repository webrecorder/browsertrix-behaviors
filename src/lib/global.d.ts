import { type BehaviorManager } from "..";

export {}; // Ensure this is treated as a module

interface BehaviorGlobals {
  __bx_addLink?: (url: string) => Promise<void>;
  __bx_fetch?: (url: string) => Promise<boolean>;
  __bx_addSet?: (url: string) => Promise<boolean>;
  __bx_netIdle?: (params: {
    idleTime: number;
    concurrency: number;
  }) => Promise<void>;
  __bx_initFlow?: (params: any) => Promise<number>;
  __bx_nextFlowStep?: (id: number) => Promise<any>;
  __bx_contentCheckFailed?: (reason: string) => void;
  __bx_open?: (params: { url: string | URL }) => Promise<void>;
  __bx_openResolve?: (window: WindowProxy | null) => void;
  __bx_behaviors?: BehaviorManager;
}

interface AutoplayProperties {
  __bx_autoplay_found?: boolean;
}

declare global {
  interface WorkerGlobalScope extends BehaviorGlobals {}
  interface Window extends BehaviorGlobals {
    __WB_replay_top?: Window;

    /**
     * Chrome DevTools’s `getEventListeners` API
     * @see https://developer.chrome.com/docs/devtools/console/utilities/#getEventListeners-function
     */
    getEventListeners: <Obj>(
      obj: Obj,
    ) => Record<
      Obj extends Window ? keyof WindowEventMap : string,
      EventListenerOrEventListenerObject[]
    >;
  }

  interface HTMLVideoElement extends AutoplayProperties {}
  interface HTMLAudioElement extends AutoplayProperties {}
  interface HTMLPictureElement extends AutoplayProperties {}
}
