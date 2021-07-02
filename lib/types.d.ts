import { IncomingMessage } from "http";

declare namespace beeline {

  export interface SamplerResponse {
    sampleRate?: number;
    shouldSample: boolean;
  }

  export interface BeelineOpts {
    writeKey?: string;
    dataset?: string;
    serviceName?: string;
    sampleRate?: number;
    enabledInstrumentations?: string[];
    impl?: "libhoney-event" | "mock";

    samplerHook?(event: unknown): SamplerResponse;
    presendHook?(event: unknown): void;
    disableInstrumentation?: boolean;

    express?: {
      userContext?: MetadataContext;
      traceIdSource?: string | ((req: IncomingMessage) => string);
      parentIdSource?: string | ((req: IncomingMessage) => string);
    };

    fastify?: {
      userContext?: MetadataContext;
      traceIdSource?: string | ((req: IncomingMessage) => string);
      parentIdSource?: string | ((req: IncomingMessage) => string);
    };

    mongodb?: {
      includeDocuments?: boolean;
    };

    httpTraceParserHook?: HttpTraceParserHook;
    httpTracePropagationHook?: HttpTracePropagationHook;
    transmission?: string;
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

  type SpanFn<F> = (...args: any[]) => F;

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
    /** @deprecated this method will be removed in the next major release. */
    removeContext(key: string): void;

    customContext: {
      /** @deprecated this method will be removed in the next major release. Please use .addTraceContext. */
      add(k: string, v: any): void;
      /** @deprecated this method will be removed in the next major release. */
      remove(k: string): void;
    };

    bindFunctionToTrace<F>(fn: SpanFn<F>): F;
    runWithoutTrace<F>(fn: SpanFn<F>): F;

    flush(): Promise<void>;

    getInstrumentations(): string[];

    /** @deprecated this method will be removed in the next major release. Please use honeycomb.marshalTraceContext() instead. */
    marshalTraceContext(ctx: MarshallableContext): string;
    /** @deprecated this method will be removed in the next major release. Please use honeycomb.unmarshalTraceContext() instead. */
    unmarshalTraceContext(ctx: string): TraceContext | undefined;

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

    /** @deprecated this constant will be removed in the next major release. Please use honeycomb.TRACE_HTTP_HEADER instead. */
    TRACE_HTTP_HEADER: string;
  }
}

declare const beeline: beeline.Beeline & beeline.Configure;

export = beeline;
