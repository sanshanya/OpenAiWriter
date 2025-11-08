export class GatewayError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor({
    code,
    message,
    status = 400,
    details,
  }: {
    code: string;
    message: string;
    status?: number;
    details?: unknown;
  }) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const validationError = (message: string, details?: unknown) =>
  new GatewayError({
    code: "INVALID_REQUEST",
    message,
    status: 422,
    details,
  });

export const unauthorizedError = (message = "Missing API key.") =>
  new GatewayError({
    code: "UNAUTHORIZED",
    message,
    status: 401,
  });

export const flowError = (message: string) =>
  new GatewayError({
    code: "FLOW_NOT_FOUND",
    message,
    status: 400,
  });

export const toHttpErrorPayload = (error: unknown) => {
  if (error instanceof GatewayError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "AI gateway failed to process the request.",
      },
    },
  };
};
