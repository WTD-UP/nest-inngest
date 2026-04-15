import { Inngest, InngestFunction, HandlerWithTriggers, GetStepTools } from 'inngest';
import { NestModule, OnApplicationShutdown, MiddlewareConsumer } from '@nestjs/common';
import { DiscoveryService, DiscoveryModule } from '@golevelup/nestjs-discovery';

type TriggerConfig = InngestFunction.Trigger<string>;
type FunctionConfig = Omit<Parameters<Inngest.Any["createFunction"]>[0], "triggers">;
declare class NestInngest<TInngest extends Inngest.Any> {
    protected readonly inngest: TInngest;
    constructor(inngest: TInngest);
    static from<TOpts extends Inngest.Any>(inngest: TOpts): NestInngest<TOpts>;
    /**
     * Inngest function decorator
     * Accepts function config WITHOUT triggers (triggers come from @Trigger decorator or triggers property)
     */
    Function(args: FunctionConfig | Parameters<TInngest["createFunction"]>[0]): (target: Object, key: string | symbol, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Inngest function trigger decorator (syntactic sugar)
     * Supports single or multiple triggers via variadic arguments or stacked decorators.
     * Triggers collected here are merged into the config at discovery time.
     */
    Trigger(...configs: TriggerConfig[]): (target: Object, key: string | symbol, descriptor: PropertyDescriptor) => PropertyDescriptor;
}
declare namespace NestInngest {
    /**
     * Type helper for handler context, derived from trigger types.
     *
     * Usage with eventType objects:
     *   NestInngest.context<typeof inngest, [typeof orderCreated]>
     *
     * Usage with multiple triggers:
     *   NestInngest.context<typeof inngest, [typeof orderCreated, typeof orderUpdated]>
     */
    type context<TInngest extends Inngest.Any, TTriggers extends readonly any[]> = Parameters<HandlerWithTriggers<GetStepTools<TInngest>, TTriggers>>[0];
}

/**
 * Error thrown when the Inngest connection fails.
 */
declare class InngestConnectionError extends Error {
    readonly cause?: Error;
    constructor(message: string, cause?: Error);
}
declare const INNGEST_KEY: "INNGEST";
declare const INNGEST_OPTIONS: "INNGEST_OPTIONS";
declare const INNGEST_FUNCTION: "INNGEST_FUNCTION";
declare const INNGEST_TRIGGER: "INNGEST_TRIGGER";
/**
 * Configuration options for Connect mode
 */
interface InngestConnectOptions {
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
interface InngestModuleOptions {
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
declare class InngestModule implements NestModule, OnApplicationShutdown {
    private readonly discover;
    private readonly inngest;
    private readonly options;
    private workerConnection?;
    constructor(discover: DiscoveryService, inngest: Inngest, options: Omit<InngestModuleOptions, "inngest">);
    static forRoot({ inngest, ...options }: InngestModuleOptions): {
        imports: (typeof DiscoveryModule)[];
        module: typeof InngestModule;
        providers: ({
            provide: "INNGEST";
            useFactory: () => Inngest.Any;
        } | {
            provide: "INNGEST_OPTIONS";
            useFactory: () => {
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
            };
        })[];
        exports: never[];
        global: boolean;
    };
    private discoverFunctions;
    configure(consumer: MiddlewareConsumer): Promise<void>;
    onApplicationShutdown(signal?: string): Promise<void>;
}

type ExtractClientOptions<T> = T extends Inngest<infer I> ? I : never;

export { type ExtractClientOptions, INNGEST_FUNCTION, INNGEST_KEY, INNGEST_OPTIONS, INNGEST_TRIGGER, type InngestConnectOptions, InngestConnectionError, InngestModule, type InngestModuleOptions, NestInngest };
