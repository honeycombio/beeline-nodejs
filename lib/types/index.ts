import * as api from '@opentelemetry/api';
import { HttpTraceContext } from '@opentelemetry/core';

export interface ExporterConfig {
    logger?: api.Logger;
    APIHost: string;
    APIKey: string;
    dataset: string;
}

export interface PropagationContext {
    traceId: string;
    parentSpanId: string;
    dataset: string;
    traceContext?: {};
    traceFlags?: any;
}

export interface SpanContext {
    'trace.trace_id': string;
    'trace.span_id': string;
    name: string;
    start_time: Date;
    duration_ms: number;
    'response.status_code': number;
    'status.message': string;
    'meta.beeline_version': number;
    service_name: string;
    //event type
    'meta.type': string;
    'meta.package': string;
    'meta.package_version': string;
    'meta.instrumentations': Instrumentations;
    'meta.node_version': number;
    'meta.local_hostname': string;
}

enum Instrumentations {
    Bluebird = "bluebird",
    ChildProcess = "child_process",
    Express = "express",
    Fastify = "fastify",
    HTTP = "http",
    HTTPS = "https",
    MongoDB = "mongodb",
    Mongoose = "mongoose",
    MPromise = "mpromise",
    MySQL = "mysql2",
    PG = "pg",
    ReactDomServer = "react-dom/server",
    Sequelize = "sequelize",
}