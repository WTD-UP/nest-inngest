# nest-inngest

[![npm](https://img.shields.io/npm/v/nest-inngest)](https://www.npmjs.com/package/nest-inngest)

An unofficial strongly typed [Inngest](https://inngest.com) module for Nest.js projects. Compatible with Inngest TS SDK v4.

## Overview

`nest-inngest` is a library designed for the Nest.js framework, allowing you to leverage all the benefits of the framework, such as Dependency Injection (DI).

## Getting Started

> Disclaimer: This guide serves as an example of how to use the `nest-inngest` library. The structure used in the examples is purely illustrative, and you are free to adapt it to your project's current structure.

1. Install the library using your preferred package manager.

   ```shell
    pnpm add nest-inngest inngest@^4
   ```

2. In your app.module.ts or a similar file, add a new item to the `imports` array.

   ### HTTP Serve Mode (Default)

   Traditional HTTP endpoint where Inngest calls your application:

   ```ts
   // app.module.ts
   import { Module } from "@nestjs/core";

   import { InngestModule } from "nest-inngest";

   import { inngest } from "../lib/inngest";

   @Module({
     imports: [
       InngestModule.forRoot({
         inngest,
         path: "/api/inngest",
       }),
     ],
     controllers: [],
     providers: [],
   })
   export class AppModule {}
   ```

   ### Connect Mode (WebSocket)

   Persistent WebSocket connection with lower latency - your application connects to Inngest:

   ```ts
   // app.module.ts
   import { Module } from "@nestjs/core";

   import { InngestModule } from "nest-inngest";

   import { inngest } from "../lib/inngest";

   @Module({
     imports: [
       InngestModule.forRoot({
         inngest,
         mode: "connect",
         connectOptions: {
           instanceId: "my-worker-1",       // Optional: unique instance ID
           maxWorkerConcurrency: 10,        // Optional: max concurrent steps
         },
       }),
     ],
     controllers: [],
     providers: [],
   })
   export class AppModule {}
   ```

   **Connect Mode Benefits:**
   - Lower latency (no HTTP round-trips)
   - Elastic horizontal scaling
   - Better support for long-running steps
   - Firewall-friendly (outbound connection only)

   **CRITICAL for Connect Mode: Enable Shutdown Hooks**

   To prevent zombie WebSocket connections, you **MUST** enable NestJS shutdown hooks in your `main.ts`:

   ```ts
   // main.ts
   async function bootstrap() {
     const app = await NestFactory.create(AppModule);

     // REQUIRED for Connect mode to properly close WebSocket connections
     app.enableShutdownHooks();

     await app.listen(3000);
   }
   bootstrap();
   ```

   Without `enableShutdownHooks()`, your WebSocket connections will become zombies when the app restarts or shuts down, remaining connected indefinitely in the Inngest dashboard.

3. Define your Inngest client and event types.

   Inngest v4 uses `eventType()` to define events individually, replacing the old centralized `EventSchemas` approach.

   ```ts
   // src/lib/inngest.ts
   import { Inngest, eventType } from "inngest";
   import { NestInngest } from "nest-inngest";
   import { z } from "zod";

   export const inngest = new Inngest({ id: "orders" });

   // Define events with runtime validation (Zod)
   export const orderCreated = eventType("orders/order.created", {
     schema: z.object({
       id: z.string().uuid(),
       product: z.string(),
       quantity: z.number(),
     }),
   });

   // instantiate and export Inngest helper decorator
   export const OrdersInngest = NestInngest.from(inngest);
   ```

   You can also use `staticSchema()` for compile-time-only typing (no runtime validation):

   ```ts
   import { Inngest, eventType, staticSchema } from "inngest";

   export const inngest = new Inngest({ id: "orders" });

   type OrderCreatedData = { id: string; product: string; quantity: number };

   export const orderCreated = eventType("orders/order.created", {
     schema: staticSchema<OrderCreatedData>(),
   });
   ```

4. Assign a new Inngest function to your controller

   There are two ways to define triggers: using `eventType` objects in the `@Function` config (recommended), or using the `@Trigger` decorator as syntactic sugar.

   ### Using triggers in `@Function` config (recommended)

   ```ts
   import { Controller } from "@nestjs/common";
   import { NestInngest } from "nest-inngest";

   import { OrdersInngest, inngest, orderCreated } from "../lib/inngest";

   @Controller("orders")
   export class OrdersController {
      constructor(private readonly ordersService: OrdersService) {}

      @OrdersInngest.Function({
        id: "orders-handler",
        triggers: [orderCreated],  // eventType object as trigger
      })
      public async handleOrderCreated(
        { event, step }: NestInngest.context<typeof inngest, [typeof orderCreated]>
      ) {
        // event.data is fully typed from the eventType schema
        console.log(event.data.id);
        console.log(event.data.product);

        await this.ordersService.sendOrderNotification(event.data.id);

        return { success: true };
      }
   }
   ```

   ### Using `@Trigger` decorator (syntactic sugar)

   The `@Trigger` decorator is still supported as syntactic sugar. Triggers defined via `@Trigger` are merged into the function config at discovery time.

   ```ts
   @OrdersInngest.Function({ id: "orders-handler" })
   @OrdersInngest.Trigger({ event: "orders/order.created" })
   public async handleOrderCreated(
     { event, step }: NestInngest.context<typeof inngest, [typeof orderCreated]>
   ) {
     // ...
   }
   ```

## Multiple Triggers

You can define multiple triggers for a single Inngest function handler, allowing it to respond to different events, cron schedules, or manual invocations.

### In the `@Function` config (recommended)

```ts
import { Controller } from "@nestjs/common";
import { NestInngest } from "nest-inngest";

import { OrdersInngest, inngest, orderCreated } from "../lib/inngest";

@Controller("orders")
export class OrdersController {
   constructor(private readonly ordersService: OrdersService) {}

   @OrdersInngest.Function({
     id: "orders-multi-handler",
     triggers: [orderCreated, { cron: "0 2 * * *" }],
   })
   public async handleOrderEvents(
     { event, step }: NestInngest.context<typeof inngest, [typeof orderCreated]>
   ) {
     if (event.name === "orders/order.created") {
       // Handle order creation event
       console.log("Processing new order:", event.data);
       await this.ordersService.sendOrderNotification(event.data.id);
     } else {
       // Handle cron execution (nightly reconciliation)
       console.log("Running nightly order reconciliation");
       await this.ordersService.reconcileOrders();
     }

     return { success: true };
   }
}
```

### Using `@Trigger` decorator

You can also use the `@Trigger` decorator with variadic arguments or stack multiple decorators:

```ts
// Variadic arguments
@OrdersInngest.Function({ id: "orders-multi-handler" })
@OrdersInngest.Trigger(
  { event: "orders/order.created" },
  { cron: "0 2 * * *" },
)
public async handleOrderEvents(
  { event, step }: NestInngest.context<typeof inngest, [typeof orderCreated]>
) {
  // ...
}

// Stacked decorators
@OrdersInngest.Function({ id: "orders-multi-handler" })
@OrdersInngest.Trigger({ event: "orders/order.created" })
@OrdersInngest.Trigger({ cron: "0 2 * * *" })
public async handleOrderEvents(
  { event, step }: NestInngest.context<typeof inngest, [typeof orderCreated]>
) {
  // ...
}
```

Both approaches are equivalent and will register the same triggers for your function. You can even mix `triggers` in the `@Function` config with `@Trigger` decorators — they will be merged and deduplicated.

## Context Type Helper

The `NestInngest.context` type helper provides full type safety for your handler context, derived from your `eventType` definitions.

```ts
import { NestInngest } from "nest-inngest";

// Single event trigger — event.data is typed from orderCreated's schema
NestInngest.context<typeof inngest, [typeof orderCreated]>

// Multiple event triggers — event is a union type
NestInngest.context<typeof inngest, [typeof orderCreated, typeof orderUpdated]>
```

The context includes `event`, `step`, `group`, `runId`, and `attempt`.

## Advanced Features

### Checkpointing

In Inngest v4, checkpointing is **enabled by default**. Multiple steps execute in a single request for near-zero inter-step latency. Set `maxRuntime` to 60-80% of your function timeout in serverless environments:

```ts
export const inngest = new Inngest({
  id: "orders",
  checkpointing: { maxRuntime: "50s" },
});

// Disable per-function if needed
@OrdersInngest.Function({
  id: "legacy-handler",
  checkpointing: false,
  triggers: [orderCreated],
})
public async handleOrder({ event, step }) {
  await step.run("process-order", async () => {
    // Process order
  });
}
```

### Sending Events

Use `eventType.create()` for type-safe event payloads:

```ts
await inngest.send(
  orderCreated.create({ id: "abc-123", product: "Widget", quantity: 5 })
);
```

## Deployment Modes Comparison

| Feature | Serve Mode (HTTP) | Connect Mode (WebSocket) |
|---------|------------------|-------------------------|
| Connection | Inbound (Inngest -> App) | Outbound (App -> Inngest) |
| Latency | Higher | Lower |
| Firewall | Requires open port | Outbound only |
| Scaling | Horizontal | Elastic horizontal |
| Setup | Simple | Simple |
| Best For | Traditional deployments | High-performance, containerized apps |

## Migrating from nest-inngest v1.x (Inngest SDK v3)

If you're upgrading from nest-inngest v1.x (which used Inngest SDK v3), here are the key changes:

### Event Schemas

```ts
// Before (v3): centralized EventSchemas on client
import { Inngest, EventSchemas } from "inngest";
const inngest = new Inngest({
  id: "orders",
  schemas: new EventSchemas().fromZod({ ... }),
});

// After (v4): individual eventType() definitions
import { Inngest, eventType } from "inngest";
const inngest = new Inngest({ id: "orders" });
const orderCreated = eventType("orders/order.created", {
  schema: z.object({ ... }),
});
```

### Context Type Helper

```ts
// Before (v3): event name string
NestInngest.context<typeof OrdersInngest, "orders/order.created">

// After (v4): eventType triggers tuple
NestInngest.context<typeof inngest, [typeof orderCreated]>
```

### Triggers (optional change)

The `@Trigger` decorator still works. Optionally move triggers into `@Function` config:

```ts
// Before (v3)
@OrdersInngest.Function({ id: "handler" })
@OrdersInngest.Trigger({ event: "orders/order.created" })

// After (v4) — either approach works
@OrdersInngest.Function({ id: "handler", triggers: [orderCreated] })
// or keep using @Trigger decorator as before
```

### Other v4 Changes

- **Default mode is cloud** — use `isDev: true` or `INNGEST_DEV=1` for local development
- **`logLevel` removed** — use `logger: new ConsoleLogger({ level: "debug" })` instead
- **`serveHost` renamed** to `serveOrigin`
- **Checkpointing enabled by default** — set `maxRuntime` for serverless
- **`optimizeParallelism` enabled by default** — use `group.parallel()` for race semantics

See the [Inngest v4 migration guide](https://www.inngest.com/docs/guides/migrate-to-v4) for full details.

## Troubleshooting

### Connection Fails on Startup (Connect Mode)

**Problem**: Your application fails to start due to Inngest connection issues.

**Symptoms**:
```
[Inngest] Connecting to Inngest...
Error: Failed to connect to Inngest: ...
```

**Handling Connection Errors**:

This library exports an `InngestConnectionError` that you can catch and handle:

```ts
import { InngestConnectionError } from 'nest-inngest';

// In your main.ts or bootstrap function, you may want to handle these:
async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    app.enableShutdownHooks();
    await app.listen(3000);
  } catch (error) {
    if (error instanceof InngestConnectionError) {
      console.error('Inngest connection failed:', error.message);
      // Decide whether to exit or continue without Inngest
      process.exit(1);
    }
    throw error;
  }
}
```

**Root Causes & Solutions**:

1. **Network Issues / Firewall Blocking**:
   - Inngest Connect uses outbound WebSocket connections
   - Check firewall rules allow outbound HTTPS (443)
   - Verify DNS resolution for Inngest endpoints
   - Test network connectivity: `curl -v https://inn.gs`

2. **Wrong Inngest Environment/API Key**:
   - Verify your Inngest client configuration
   - Check `INNGEST_EVENT_KEY` or `INNGEST_SIGNING_KEY` environment variables
   - Ensure you're connecting to the correct Inngest environment

3. **Behind Corporate Proxy**:
   - Configure Node.js proxy settings:
     ```bash
     export HTTP_PROXY=http://proxy.company.com:8080
     export HTTPS_PROXY=http://proxy.company.com:8080
     ```

**Quick Debug**:
```ts
// Temporarily switch to serve mode to test if it's a Connect-specific issue
InngestModule.forRoot({
  inngest,
  mode: "serve",  // Use HTTP mode instead
  path: "/api/inngest",
})
```

### Zombie WebSocket Connections (Connect Mode)

**Problem**: After deploying or restarting your app, old worker connections remain active in Inngest dashboard.

**Root Cause**: NestJS shutdown hooks are not enabled, so the WebSocket connection isn't closed properly on shutdown.

**Solution**:

1. **Enable shutdown hooks in your `main.ts`** (Required):
   ```ts
   async function bootstrap() {
     const app = await NestFactory.create(AppModule);
     app.enableShutdownHooks(); // CRITICAL!
     await app.listen(3000);
   }
   ```

2. **Verify logs show proper shutdown**:
   ```
   [Inngest] WebSocket connected (ID: wkr_abc123)
   ...
   [Inngest] Shutting down WebSocket connection (signal: SIGTERM)
   [Inngest] WebSocket connection closed successfully
   ```

3. **Clean up existing zombie connections**:
   - Unfortunately, Inngest doesn't provide a UI button to terminate connections
   - Zombie connections will eventually timeout (typically after 60-90 seconds of no heartbeat)
   - To force cleanup: restart your app WITH `enableShutdownHooks()` enabled
   - The new instance will have a different connection ID, and old connections will timeout

**For Docker/Kubernetes**:
- Ensure SIGTERM signals are properly forwarded to Node.js
- Set appropriate `terminationGracePeriodSeconds` (minimum 30s recommended)
- Use `preStop` hooks if needed:
  ```yaml
  lifecycle:
    preStop:
      exec:
        command: ["/bin/sh", "-c", "sleep 15"]
  ```

**Prevention Checklist**:
- `app.enableShutdownHooks()` is called
- Connect mode uses `handleShutdownSignals: []` (library handles this)
- Container orchestration forwards SIGTERM properly
- Graceful shutdown timeout is adequate (10-30 seconds)

## Roadmap

- [x] Add a global Nest module using the `.forRoot` pattern.
- [x] Export a class that accepts an instance of Inngest in the constructor and exposes typed decorators.
  - [x] `Function` decorator
  - [x] `Trigger` decorator (also kept as syntactic sugar in v4)
- [x] Add typing helpers.
  - [x] Helper for typing the `Context`
- [x] Support for Inngest Connect mode (WebSocket)
- [x] Support for Inngest SDK v4 (`eventType`, 2-arg `createFunction`, `HandlerWithTriggers` context)
- [x] Add automated tests.
- [ ] Add automatic documentation in the AsyncAPI spec. (TBD)
- [ ] Add Github actions with changelogs and auto releases
