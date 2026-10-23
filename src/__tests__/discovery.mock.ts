import type {
  DiscoveredClass,
  DiscoveredMethodWithMeta,
} from "@golevelup/nestjs-discovery";

/**
 * Builds a discovery result shaped like what DiscoveryService returns, with
 * only the fields InngestModule reads populated.
 */
export function mockDiscovered<T>(
  handler: (...args: any[]) => any,
  meta: T,
): DiscoveredMethodWithMeta<T> {
  return {
    discoveredMethod: {
      handler,
      methodName: handler.name,
      parentClass: { instance: {} } as DiscoveredClass,
    },
    meta,
  };
}
