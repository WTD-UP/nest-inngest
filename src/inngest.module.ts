import { Inject, MiddlewareConsumer, NestModule, OnApplicationShutdown } from "@nestjs/common";

import { DiscoveryModule, DiscoveryService } from "@golevelup/nestjs-discovery";
import { type InngestFunction, Inngest } from "inngest";
import { connect } from "inngest/connect";
import { serve } from "inngest/express";

/**
 * Error thrown when the Inngest connection fails.
 */
export class InngestConnectionError extends Error {
  readonly cause?: Error;
  
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'InngestConnectionError';
    this.cause = cause;
  }
}

export const INNGEST_KEY = "INNGEST" as const;
export const INNGEST_OPTIONS = "INNGEST_OPTIONS" as const;
export const INNGEST_FUNCTION = "INNGEST_FUNCTION" as const;
export const INNGEST_TRIGGER = "INNGEST_TRIGGER" as const;

type TriggerConfig = InngestFunction.Trigger<string>;

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

/**
 * Configuration options for Connect mode
 */
export interface InngestConnectOptions {
  /**
   * Unique identifier for this worker instance
   * @default Generated UUID
   */
  instanceId?: string;
  /**
   * Maximum number of concurrent steps this worker can execute
   * @default 10
   */
  maxWorkerConcurrency?: number;
  /**
   * Additional connect options
   */
  [key: string]: unknown;
}

export interface InngestModuleOptions {
  /**
   * Inngest client instance
   */
  inngest: Inngest.Any;
  /**
   * Deployment mode
   * - 'serve': HTTP endpoint (default) - Inngest calls your app via HTTP
   * - 'connect': WebSocket connection - Your app connects to Inngest via WebSocket
   * @default "serve"
   */
  mode?: "serve" | "connect";
  /**
   * Path that inngest will be listening (only used in 'serve' mode)
   * @default "/api/inngest"
   */
  path?: string;
  /**
   * Connect mode configuration (only used in 'connect' mode)
   */
  connectOptions?: InngestConnectOptions;
}

export class InngestModule implements NestModule, OnApplicationShutdown {
  private workerConnection?: { close: () => Promise<void> };

  constructor(
    @Inject(DiscoveryService) private readonly discover: DiscoveryService,
    @Inject(INNGEST_KEY) private readonly inngest: Inngest,
    @Inject(INNGEST_OPTIONS)
    private readonly options: Omit<InngestModuleOptions, "inngest">,
  ) {
    // Make injected dependencies non-enumerable to prevent serialization issues
    // See: https://github.com/nestjs/nest/issues/12738
    Object.defineProperty(this, 'discover', { enumerable: false });
    Object.defineProperty(this, 'inngest', { enumerable: false });
    Object.defineProperty(this, 'options', { enumerable: false });
    Object.defineProperty(this, 'workerConnection', { enumerable: false });
  }

  static forRoot({ inngest, ...options }: InngestModuleOptions) {
    return {
      imports: [DiscoveryModule],
      module: InngestModule,
      providers: [
        {
          provide: INNGEST_KEY,
          useFactory: () => inngest,
        },
        {
          provide: INNGEST_OPTIONS,
          useFactory: () => options,
        },
      ],
      exports: [],
      global: true,
    };
  }

  private async discoverFunctions() {
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

    return functions.flat().map((func) => {
      // Collect triggers from @Trigger decorator metadata
      const triggerMeta = triggers
        .flat()
        .filter(
          (each) =>
            each.discoveredMethod.handler === func.discoveredMethod.handler,
        )
        .flatMap((each) => each.meta as TriggerConfig[])
        .filter(Boolean);

      const uniqueDecoratorTriggers = dedupeTriggers(triggerMeta);

      // Merge: config may already have triggers (v4 native), plus @Trigger decorator triggers
      const config = func.meta as Record<string, any>;
      const configTriggers = config.triggers
        ? (Array.isArray(config.triggers) ? config.triggers : [config.triggers])
        : [];
      const allTriggers = dedupeTriggers([...configTriggers, ...uniqueDecoratorTriggers]);

      const triggers_arg =
        allTriggers.length === 0
          ? undefined
          : allTriggers.length === 1
            ? allTriggers[0]
            : allTriggers;

      // v4: createFunction({ ...config, triggers }, handler)
      const { triggers: _discarded, ...configWithoutTriggers } = config;

      return this.inngest.createFunction(
        // @ts-ignore
        { ...configWithoutTriggers, triggers: triggers_arg },
        func.discoveredMethod.handler.bind(
          func.discoveredMethod.parentClass.instance,
        ),
      );
    });
  }

  public async configure(consumer: MiddlewareConsumer) {
    const mode = this.options.mode ?? "serve";
    const handlers = await this.discoverFunctions();

    if (mode === "connect") {
      // Connect mode: establish persistent WebSocket connection
      // CRITICAL: Disable Inngest's signal handling to let NestJS manage shutdown
      console.log('[Inngest] Connecting to Inngest...');

      try {
        const connection = await connect({
          apps: [{
            client: this.inngest,
            functions: handlers,
          }],
          // Disable automatic signal handling - NestJS will call onApplicationShutdown
          handleShutdownSignals: [],
          ...this.options.connectOptions,
        });

        this.workerConnection = connection;
        
        console.log(`[Inngest] WebSocket connected successfully (ID: ${connection.connectionId})`);
        console.log(`[Inngest] Connection state: ${connection.state}`);
      } catch (error) {
        throw new InngestConnectionError(
          `Failed to connect to Inngest: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          `Check your network connection and Inngest configuration.`,
          error instanceof Error ? error : undefined
        );
      }
    } else {
      // Serve mode: traditional HTTP endpoint
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

  async onApplicationShutdown(signal?: string) {
    // Gracefully shutdown Connect mode connection if active
    if (this.workerConnection) {
      try {
        console.log(`[Inngest] Shutting down WebSocket connection (signal: ${signal || 'unknown'})`);
        
        // Close with timeout to prevent hanging
        await Promise.race([
          this.workerConnection.close(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection close timeout')), 10000)
          ),
        ]);
        
        console.log('[Inngest] WebSocket connection closed successfully');
      } catch (error) {
        console.error('[Inngest] Error closing WebSocket connection:', error);
        // Force cleanup even if close fails
      } finally {
        this.workerConnection = undefined;
      }
    }
  }
}
