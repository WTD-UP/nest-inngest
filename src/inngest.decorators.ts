import {
  type GetStepTools,
  type HandlerWithTriggers,
  type InngestFunction,
  Inngest,
} from "inngest";

import { INNGEST_FUNCTION, INNGEST_TRIGGER } from "@/inngest.module";

// Type for trigger configuration — in v4, triggers are part of the config object (arg[0])
type TriggerConfig = InngestFunction.Trigger<string>;

// Extract the config type for createFunction (first arg, without triggers)
type FunctionConfig = Omit<Parameters<Inngest.Any["createFunction"]>[0], "triggers">;

export class NestInngest<TInngest extends Inngest.Any> {
  constructor(protected readonly inngest: TInngest) {}

  static from<TOpts extends Inngest.Any>(inngest: TOpts) {
    return new NestInngest<TOpts>(inngest);
  }

  /**
   * Inngest function decorator
   * Accepts function config WITHOUT triggers (triggers come from @Trigger decorator or triggers property)
   */
  public Function(args: FunctionConfig | Parameters<TInngest["createFunction"]>[0]) {
    return (
      target: Object,
      key: string | symbol,
      descriptor: PropertyDescriptor,
    ) => {
      Reflect.defineMetadata(INNGEST_FUNCTION, args, descriptor.value);
      return descriptor;
    };
  }

  /**
   * Inngest function trigger decorator (syntactic sugar)
   * Supports single or multiple triggers via variadic arguments or stacked decorators.
   * Triggers collected here are merged into the config at discovery time.
   */
  public Trigger(...configs: TriggerConfig[]) {
    return (
      target: Object,
      key: string | symbol,
      descriptor: PropertyDescriptor,
    ) => {
      const existing =
        (Reflect.getMetadata(INNGEST_TRIGGER, descriptor.value) as TriggerConfig[] | undefined) ?? [];

      Reflect.defineMetadata(
        INNGEST_TRIGGER,
        [...existing, ...configs],
        descriptor.value,
      );

      return descriptor;
    };
  }
}

export namespace NestInngest {
  /**
   * Type helper for handler context, derived from trigger types.
   *
   * Usage with eventType objects:
   *   NestInngest.context<typeof inngest, [typeof orderCreated]>
   *
   * Usage with multiple triggers:
   *   NestInngest.context<typeof inngest, [typeof orderCreated, typeof orderUpdated]>
   */
  export type context<
    TInngest extends Inngest.Any,
    TTriggers extends readonly any[],
  > = Parameters<HandlerWithTriggers<GetStepTools<TInngest>, TTriggers>>[0];
}
