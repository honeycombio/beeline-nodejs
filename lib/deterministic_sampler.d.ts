import { SamplerResponse } from "./types";

// Note that this is more specific than upstream `types.d.ts`.  They define the
// samplerHook function's argument as `event: unknown`.  We're more opinionated.
interface SamplerFn {
  (data: {[key: string]: any}): SamplerResponse;
}

export default function(sampleRate: number) : SamplerFn;
