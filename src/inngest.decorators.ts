import { GetEvents, Inngest } from "inngest";
import { Context } from "inngest/types";

import { INNGEST_FUNCTION, INNGEST_TRIGGER } from "@/inngest.module";

// Type for trigger configuration
type TriggerConfig = NonNullable<Parameters<Inngest.Any["createFunction"]>[1]>;

export type ExtractInngest<T> = T extends NestInngest<infer I> ? I : never;

export class NestInngest<TInngest extends Inngest.Any> {
  constructor(protected readonly inngest: TInngest) {}

  static from<TOpts extends Inngest.Any>(inngest: TOpts) {
    return new NestInngest<TOpts>(inngest);
  }

  /**
   * Inngest function decorator
   */
  public Function(args: Parameters<TInngest["createFunction"]>[0]) {
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
   * Inngest function trigger decorator
   * Supports single or multiple triggers via variadic arguments or stacked decorators
   */
  public Trigger(...configs: Parameters<TInngest["createFunction"]>[1][]) {
    return (
      target: Object,
      key: string | symbol,
      descriptor: PropertyDescriptor,
    ) => {
      const existing =
        (Reflect.getMetadata(INNGEST_TRIGGER, descriptor.value) as TriggerConfig[] | undefined) ?? [];

      const normalized = configs.flat();

      Reflect.defineMetadata(
        INNGEST_TRIGGER,
        [...existing, ...normalized],
        descriptor.value,
      );

      return descriptor;
    };
  }
}

export namespace NestInngest {
  export type context<
    TInngest,
    TEvent extends keyof GetEvents<ExtractInngest<TInngest>> & string,
  > = Context<ExtractInngest<TInngest>, TEvent>;
}
