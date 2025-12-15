import { Inngest, GetEvents } from 'inngest';
import { Context } from 'inngest/types';
import { NestModule, OnApplicationShutdown, MiddlewareConsumer } from '@nestjs/common';
import { DiscoveryService, DiscoveryModule } from '@golevelup/nestjs-discovery';

type ExtractInngest<T> = T extends NestInngest<infer I> ? I : never;
declare class NestInngest<TInngest extends Inngest.Any> {
    protected readonly inngest: TInngest;
    constructor(inngest: TInngest);
    static from<TOpts extends Inngest.Any>(inngest: TOpts): NestInngest<TOpts>;
    /**
     * Inngest function decorator
     */
    Function(args: Parameters<TInngest["createFunction"]>[0]): (target: Object, key: string | symbol, descriptor: PropertyDescriptor) => PropertyDescriptor;
    /**
     * Inngest function trigger decorator
     * Supports single or multiple triggers via variadic arguments or stacked decorators
     */
    Trigger(...configs: Parameters<TInngest["createFunction"]>[1][]): (target: Object, key: string | symbol, descriptor: PropertyDescriptor) => PropertyDescriptor;
}
declare namespace NestInngest {
    type context<TInngest, TEvent extends keyof GetEvents<ExtractInngest<TInngest>> & string> = Context<ExtractInngest<TInngest>, TEvent>;
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
            useValue: Inngest.Any;
        } | {
            provide: "INNGEST_OPTIONS";
            useValue: {
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

export { ExtractClientOptions, ExtractInngest, INNGEST_FUNCTION, INNGEST_KEY, INNGEST_OPTIONS, INNGEST_TRIGGER, InngestConnectOptions, InngestModule, InngestModuleOptions, NestInngest };
