import { Inngest, GetEvents } from 'inngest';
import { Context } from 'inngest/types';
import { NestModule, MiddlewareConsumer } from '@nestjs/common';
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
interface InngestModuleOptions {
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
declare class InngestModule implements NestModule {
    private readonly discover;
    private readonly inngest;
    private readonly options;
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
                 * Path that inngest will be listening
                 * @default "/api/inngest"
                 */
                path?: string;
            };
        })[];
        exports: never[];
        global: boolean;
    };
    configure(consumer: MiddlewareConsumer): Promise<void>;
}

type ExtractClientOptions<T> = T extends Inngest<infer I> ? I : never;

export { ExtractClientOptions, ExtractInngest, INNGEST_FUNCTION, INNGEST_KEY, INNGEST_OPTIONS, INNGEST_TRIGGER, InngestModule, InngestModuleOptions, NestInngest };
