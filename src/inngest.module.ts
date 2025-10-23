import { Inject, MiddlewareConsumer, NestModule } from "@nestjs/common";

import { DiscoveryModule, DiscoveryService } from "@golevelup/nestjs-discovery";
import { Inngest } from "inngest";
import { serve } from "inngest/express";

export const INNGEST_KEY = "INNGEST" as const;
export const INNGEST_OPTIONS = "INNGEST_OPTIONS" as const;
export const INNGEST_FUNCTION = "INNGEST_FUNCTION" as const;
export const INNGEST_TRIGGER = "INNGEST_TRIGGER" as const;

type TriggerConfig = NonNullable<Parameters<Inngest.Any["createFunction"]>[1]>;

/**
 * Deduplicates trigger configurations while preserving order
 */
function dedupeTriggers(triggers: TriggerConfig[]): TriggerConfig[] {
  const seen = new Set<string>();

  return triggers.filter((trigger) => {
    const key = JSON.stringify(trigger);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export interface InngestModuleOptions {
  /**
   * Inngest client instance
   */
  inngest: Inngest.Any;
  /**
   * Path that inngest will be listening
   * @default "/api/inngest"
   */
  path?: string;
}

export class InngestModule implements NestModule {
  constructor(
    @Inject(DiscoveryService) private readonly discover: DiscoveryService,
    @Inject(INNGEST_KEY) private readonly inngest: Inngest,
    @Inject(INNGEST_OPTIONS)
    private readonly options: Omit<InngestModuleOptions, "inngest">,
  ) {}

  static forRoot({ inngest, ...options }: InngestModuleOptions) {
    return {
      imports: [DiscoveryModule],
      module: InngestModule,
      providers: [
        {
          provide: INNGEST_KEY,
          useValue: inngest,
        },
        {
          provide: INNGEST_OPTIONS,
          useValue: options,
        },
      ],
      exports: [],
      global: true,
    };
  }

  public async configure(consumer: MiddlewareConsumer) {
    const [functions, triggers] = await Promise.all([
      Promise.all([
        this.discover.controllerMethodsWithMetaAtKey(INNGEST_FUNCTION),
        this.discover.providerMethodsWithMetaAtKey(INNGEST_FUNCTION),
      ]),
      Promise.all([
        this.discover.controllerMethodsWithMetaAtKey(INNGEST_TRIGGER),
        this.discover.providerMethodsWithMetaAtKey(INNGEST_TRIGGER),
      ]),
    ]);

    const handlers = functions.flat().map((func) => {
      const triggerMeta = triggers
        .flat()
        .filter(
          (each) =>
            each.discoveredMethod.handler === func.discoveredMethod.handler,
        )
        .flatMap((each) => each.meta as TriggerConfig[])
        .filter(Boolean);

      const uniqueTriggers = dedupeTriggers(triggerMeta);

      const triggerArg =
        uniqueTriggers.length === 0
          ? undefined
          : uniqueTriggers.length === 1
            ? uniqueTriggers[0]
            : uniqueTriggers;

      return this.inngest.createFunction(
        // @ts-ignore
        func.meta,
        triggerArg,
        func.discoveredMethod.handler.bind(
          func.discoveredMethod.parentClass.instance,
        ),
      );
    });

    consumer
      .apply(
        serve({
          client: this.inngest,
          functions: handlers,
        }),
      )
      .forRoutes(this.options.path ?? "/api/inngest");
  }
}
