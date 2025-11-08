'use client';

import type {
  ErrorEvent,
  FinalEvent,
  PatchEvent,
  StepEvent,
  TokenEvent,
} from "@/lib/ai/gateway/events";

type WriterCallbacks = {
  onStepStart?: (event: StepEvent) => void;
  onBeforeFirstToken?: (event: StepEvent) => void;
  onToken?: (event: TokenEvent) => void;
  onPatch?: (event: PatchEvent) => void;
  onError?: (event: ErrorEvent) => void;
  onFinal?: (event: FinalEvent) => void;
};

export type GatewayRunController = ReturnType<typeof createGatewayRunController>;

export function createGatewayRunController(callbacks: WriterCallbacks) {
  let currentRunId: string | null = null;
  let cancelCurrent: (() => void) | null = null;
  let awaitingFirstToken = false;
  let firstStepEvent: StepEvent | null = null;

  const beginRun = (runId: string, onCancel?: () => void) => {
    if (cancelCurrent) {
      cancelCurrent();
    }
    currentRunId = runId;
    cancelCurrent = onCancel ?? null;
    awaitingFirstToken = false;
    firstStepEvent = null;
  };

  const handleEvent = (event: StepEvent | TokenEvent | PatchEvent | ErrorEvent | FinalEvent) => {
    if (!currentRunId || event.runId !== currentRunId) {
      return;
    }

    switch (event.type) {
      case "step": {
        callbacks.onStepStart?.(event);
        if (event.phase === "start") {
          firstStepEvent = event;
          awaitingFirstToken = event.renderMode === "streaming-text";
        }
        if (event.phase === "finish") {
          awaitingFirstToken = false;
        }
        break;
      }
      case "token": {
        if (awaitingFirstToken && firstStepEvent) {
          awaitingFirstToken = false;
          callbacks.onBeforeFirstToken?.(firstStepEvent);
        }
        callbacks.onToken?.(event);
        break;
      }
      case "patch": {
        callbacks.onPatch?.(event);
        break;
      }
      case "error": {
        callbacks.onError?.(event);
        break;
      }
      case "final": {
        callbacks.onFinal?.(event);
        currentRunId = null;
        firstStepEvent = null;
        awaitingFirstToken = false;
        cancelCurrent = null;
        break;
      }
      default:
        // no-op
        break;
    }
  };

  const cancelRun = () => {
    if (cancelCurrent) {
      cancelCurrent();
      cancelCurrent = null;
    }
    currentRunId = null;
    awaitingFirstToken = false;
  };

  return {
    beginRun,
    handleEvent,
    cancelRun,
    get currentRunId() {
      return currentRunId;
    },
  };
}
