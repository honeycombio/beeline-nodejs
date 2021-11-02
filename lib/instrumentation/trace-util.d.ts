import { IncomingMessage } from 'http';
import { TraceContext } from '../types';

// TODO: There are lots more functions exported by this file.  We did not bother
// to declare types for all of them, but we should, if we decide that we need to
// `import` them into TypeScript projects.

export function getTraceContext(traceIdSource: any, req: IncomingMessage): TraceContext
