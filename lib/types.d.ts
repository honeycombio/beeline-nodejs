import { IncomingMessage } from "http";

declare namespace beeline {
  export interface SamplerResponse {
    sampleRate?: number;
    shouldSample: boolean;
  }

  export interface LibhoneyEvent {
    data: Record<string, unknown>;
    add(data: Record<string, unknown>): this;
    addField(key: string, value: unknown): this;
  }

  export interface BeelineOpts {
    // Options passed through to libhoney
    apiHost?: string;
    proxy?: string;
    writeKey?: string;
    dataset?: string;
    sampleRate?: number;
    batchSizeTrigger?: number;
    batchTimeTrigger?: number;
    maxConcurrentBatches?: number;
    pendingWorkCapacity?: number;
    maxResponseQueueSize?: number;
    timeout?: number;
    disabled?: false;
    userAgentAddition?: string;
    transmission?: string;

    // Beeline-specific options
    serviceName?: string;
    enabledInstrumentations?: string[];
    impl?: "libhoney-event" | "mock";

    samplerHook?(event: LibhoneyEvent["data"]): SamplerResponse;
    presendHook?(event: LibhoneyEvent): void;
    httpTraceParserHook?: HttpTraceParserHook;
    httpTracePropagationHook?: HttpTracePropagationHook;

    /** @deprecated use enabledInstrumentations: [] */
    disableInstrumentation?: boolean;

    express?: {
      userContext?: MetadataContext;
      /** @deprecated use httpTraceParserHook */
      traceIdSource?: string | ((req: IncomingMessage) => string);
      /** @deprecated use httpTraceParserHook */
      parentIdSource?: string | ((req: IncomingMessage) => string);
    };

    fastify?: {
      userContext?: MetadataContext;
      /** @deprecated use httpTraceParserHook */
      traceIdSource?: string | ((req: IncomingMessage) => string);
      /** @deprecated use httpTraceParserHook */
      parentIdSource?: string | ((req: IncomingMessage) => string);
    };

    mongodb?: {
      includeDocuments?: boolean;
    };
  }

  export interface Schema {
    "meta.type"?: string;
    "meta.node_version"?: string;
    "meta.beeline_version"?: string;
    "meta.package"?: string;
    "meta.package_version"?: string;
    "meta.instrumentations"?: string;
    "meta.instrumentation_count"?: string;
    "meta.local_hostname"?: string;
    duration_ms?: number;
    "trace.trace_id"?: string;
    "trace.trace_id_source"?: string;
    "trace.parent_id"?: string;
    "trace.span_id"?: string;
    service_name?: string;
    name?: string;
  }

  export interface Span {
    addContext(metadataContext: MetadataContext): void;
    payload: Schema & MetadataContext;
    startTime: number;
    startTimeHR: [number, number];
  }

  export type MetadataContext = Record<string, any>;

  export interface TraceContext {
    traceId?: string;
    parentSpanId?: string;
    dataset?: string;
    customContext?: MetadataContext;
    source?: string;
  }

  export interface ExecutionContext {
    id?: string;
    traceContext?: MetadataContext;
    stack?: Span[];
    dataset?: string;
  }

  export type MarshallableContext = MetadataContext | ExecutionContext;

  export interface Timer {
    name: string;
    startTimeHR: [number, number];
  }

  type SpanFn<F> = (span: Span) => F;
  type AnyFunction = (...args: unknown[]) => unknown;

  type Configure = (opts?: BeelineOpts) => Beeline & Configure;

  type Headers = Record<string, string>;
  export type HttpTraceParserHook = (req: IncomingMessage) => TraceContext;
  export type HttpTracePropagationHook = (ctx: TraceContext) => Headers;

  export interface Beeline {
    traceActive(): boolean;
    clearTrace(): void;
    getTraceContext(): ExecutionContext;

    startTrace(
      metadataContext?: MetadataContext,
      traceId?: string,
      parentSpanId?: string,
      dataset?: string,
      propagatedContext?: MetadataContext
    ): Span | undefined;
    finishTrace(trace: Span): void;
    withTrace<F>(
      metadataContext: MetadataContext,
      fn: SpanFn<F>,
      traceId?: string,
      parentSpanId?: string,
      dataset?: string,
      propagatedContext?: MetadataContext
    ): F;

    startSpan(metadataContext?: MetadataContext): Span | undefined;
    finishSpan(event: Span, rollup?: string): void;
    withSpan<F>(metadataContext: MetadataContext, fn: SpanFn<F>, rollup?: string): F;
    startAsyncSpan<F>(metadataContext: MetadataContext, fn: SpanFn<F>): F;

    startTimer(name: string): Timer;
    finishTimer(timer: Timer): void;
    withTimer<F>(name: string, fn: SpanFn<F>): F;

    addTraceContext(metadataContext: MetadataContext): void;
    addContext(metadataContext: MetadataContext): void;

    bindFunctionToTrace<T extends AnyFunction>(fn: T): T;
    runWithoutTrace<T extends AnyFunction>(fn: T): ReturnType<T>;

    flush(): Promise<void>;

    getInstrumentations(): string[];

    honeycomb: {
      marshalTraceContext(ctx: MarshallableContext): string;
      unmarshalTraceContext(honeycombTraceHeader: string): TraceContext | undefined;
      httpTraceParserHook: HttpTraceParserHook;
      httpTracePropagationHook: HttpTracePropagationHook;
      TRACE_HTTP_HEADER: string;
    };

    w3c: {
      marshalTraceContext(ctx: MarshallableContext): string;
      unmarshalTraceContext(traceparent: string, tracestate?: string): TraceContext | undefined;
      httpTraceParserHook: HttpTraceParserHook;
      httpTracePropagationHook: HttpTracePropagationHook;
      TRACE_HTTP_HEADER: string;
    };

    aws: {
      marshalTraceContext(ctx: MarshallableContext): string;
      unmarshalTraceContext(amazonTraceHeader: string): TraceContext | undefined;
      httpTraceParserHook: HttpTraceParserHook;
      httpTracePropagationHook: HttpTracePropagationHook;
      TRACE_HTTP_HEADER: string;
    };

    /**
     * When using the "mock" implementation, _apiForTesting() can be used to
     * inspect the events that would have been sent.
     *
     * As the name implies, this should only be used for testing purposes.
     */
    _apiForTesting(): {
      sentEvents: Span["payload"][];
      traceId: number;
    };
  }
}

declare const beeline: beeline.Beeline & beeline.Configure;

export = beeline;
