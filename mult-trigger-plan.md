# Multi-trigger Support Plan

## Goal
Implement first-class support for multiple Inngest triggers (event, cron, manual, etc.) on a single Nest handler while preserving strong typing.

## Step-by-step Breakdown

1. **Decorator API & Typing Overhaul**
   - Extend `NestInngest.Trigger` (`src/inngest.decorators.ts`) to accept single triggers, variadic arguments, and array inputs.
   - Normalize decorator arguments into an internal `TriggerConfig[]` while appending to existing metadata:

```ts
public Trigger(
  ...args: Parameters<TInngest["createFunction"]>[1] extends infer T
    ? T extends any[]
      ? [...T]
      : [T]
    : never,
) {
  const configs = args.flat();

  return (
    target: object,
    key: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const existing =
      (Reflect.getMetadata(INNGEST_TRIGGER, descriptor.value) as TriggerConfig[] | undefined) ?? [];

    const merged = [...existing, ...configs.flat()].filter(Boolean);

    Reflect.defineMetadata(INNGEST_TRIGGER, merged, descriptor.value);
    return descriptor;
  };
}
```

   - Introduce helper conditional types to infer unions of events across all triggers:

```ts
type TriggerConfig = NonNullable<Parameters<TInngest["createFunction"]>[1]>;

type TriggerArray<T> = T extends readonly unknown[] ? T : [T];

type TriggerEvents<T> = TriggerArray<T>[number] extends { event: infer E }
  ? E extends string
    ? E
    : never
  : never;

public Trigger<T extends Parameters<TInngest["createFunction"]>[1]>(
  ...configs: TriggerArray<T>
) {
  return (
    _target: object,
    _key: string | symbol,
    descriptor: PropertyDescriptor,
  ): TypedPropertyDescriptor<
    (
      ctx: Context<
        ExtractClientOptions<TInngest>,
        GetEvents<TInngest>,
        TriggerEvents<T> extends never ? any : TriggerEvents<T>
      >,
    ) => any
  > => {
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
```

   - Ensure repeated decorator usage is idempotent: when the same trigger object is provided repeatedly, dedupe by JSON signature or event name when appropriate.

2. **Metadata Aggregation in Module Wiring**
   - Update `InngestModule.configure` (`src/inngest.module.ts`) to collect all trigger metadata entries for a handler:

```ts
const handlers = functions.flat().map((func) => {
  const triggerMeta = triggers
    .flat()
    .filter((each) =>
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
    func.meta,
    triggerArg,
    func.discoveredMethod.handler.bind(
      func.discoveredMethod.parentClass.instance,
    ),
  );
});
```

   - Add a helper to dedupe trigger configs while preserving order:

```ts
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
```

   - Confirm mixed trigger kinds flow unchanged into `createFunction`:

```ts
@OrdersInngest.Trigger(
  { event: "orders/order.created" },
  { cron: "0 2 * * *", name: "orders-nightly" },
)
public async handleOrderEvents(
  ctx: NestInngest.context<
    typeof OrdersInngest,
    "orders/order.created" | "orders-nightly"
  >,
) {
  if (ctx.event.name === "orders/order.created") {
    // handle event payload
  } else {
    // cron execution logic
  }
}
```

3. **Validation & Tests**
   - Add tests verifying decorator accumulation and module aggregation:

```ts
it("registers multiple triggers for a handler", () => {
  const controller = new TestController();
  const metadata = Reflect.getMetadata(
    INNGEST_TRIGGER,
    controller.handle,
  ) as TriggerConfig[];

  expect(metadata).toEqual([
    { event: "orders/order.created" },
    { cron: "0 2 * * *", name: "orders-nightly" },
  ]);
});
```

```ts
it("passes aggregated triggers to createFunction", async () => {
  const inngest = { createFunction: vi.fn() } as unknown as Inngest;
  const module = new InngestModule(discovery, inngest, { path: "/api/inngest" });

  await module.configure(consumer);

  expect(inngest.createFunction).toHaveBeenCalledWith(
    expect.anything(),
    [
      { event: "orders/order.created" },
      { cron: "0 2 * * *", name: "orders-nightly" },
    ],
    expect.any(Function),
  );
});
```

   - Include compile-time assertions to ensure `ctx.event.name` infers a union:

```ts
const handler: Parameters<typeof controller.handle>[0] = {} as any;

expectTypeOf(handler.event.name).toEqualTypeOf<
  "orders/order.created" | "orders-nightly"
>();
```

4. **Documentation & Developer Guidance**
   - Update `README.md` with example usage:

```ts
@OrdersInngest.Trigger(
  { event: "orders/order.created" },
  { cron: "0 2 * * *", name: "orders-nightly" },
)
public async handleOrderEvents(
  ctx: NestInngest.context<
    typeof OrdersInngest,
    "orders/order.created" | "orders-nightly"
  >,
) {
  if (ctx.event.name === "orders/order.created") {
    // ingest order payload
  } else {
    // perform nightly reconciliation
  }
}
```

   - Provide guidance on narrowing event types and migration steps for existing users.

## Implementation Checklist

- [ ] Decorator accepts multi-trigger inputs, accumulates metadata, and updates context typing.
- [ ] Module wiring forwards zero/one/many triggers correctly to `createFunction`.
- [ ] Tests cover decorator metadata aggregation, module wiring behavior, and type inference guarantees.
- [ ] Documentation explains multi-trigger usage, including mixed trigger examples and migration notes.

## Detailed To-dos

- [ ] Enhance Trigger decorator to accumulate multiple triggers and expose proper event union typing.
- [ ] Update InngestModule to forward aggregated triggers to `createFunction` without losing mixed trigger types.
- [ ] Add tests/assertions for decorator aggregation, module wiring, and type inference.
- [ ] Document multi-trigger usage patterns (event + cron/manual) and migration notes.
