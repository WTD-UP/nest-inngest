import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Injectable, Module, OnModuleInit } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Inngest } from "inngest";
import "reflect-metadata";
import {
  InngestModule,
  InngestModuleOptions,
  InngestWorker,
  INNGEST_TRIGGER,
  INNGEST_FUNCTION,
} from "../inngest.module";
import { DiscoveryService } from "@golevelup/nestjs-discovery";
import { mockDiscovered } from "./discovery.mock";

// Mock the connect function
vi.mock("inngest/connect", async () => {
  return {
    connect: vi.fn().mockResolvedValue({
      connectionId: "test-connection-123",
      close: vi.fn().mockResolvedValue(undefined),
      closed: Promise.resolve(),
      state: "ACTIVE",
    }),
  };
});

describe("InngestModule - Connect Mode", () => {
  let inngest: Inngest;
  let discoveryService: DiscoveryService;
  let module: InngestModule;
  let worker: InngestWorker;

  beforeEach(() => {
    inngest = new Inngest({ id: "test-app" });

    // Mock discovery service
    discoveryService = {
      controllerMethodsWithMetaAtKey: vi.fn(),
      providerMethodsWithMetaAtKey: vi.fn(),
    } as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createModule(options: Omit<InngestModuleOptions, "inngest">) {
    worker = new InngestWorker(options);
    return new InngestModule(discoveryService, inngest, options, worker);
  }

  function setupDiscoveryMocks(handler: (...args: any[]) => any) {
    const functionMethods = [mockDiscovered(handler, { id: "test-fn" })];

    const triggerMethods = [mockDiscovered(handler, [{ event: "test/event" }])];

    vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
      if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
      if (key === INNGEST_TRIGGER) return Promise.resolve(triggerMethods);
      return Promise.resolve([]);
    });

    vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);
  }

  function setupHandler() {
    const handler = function testHandler() {};
    Reflect.defineMetadata(INNGEST_TRIGGER, [{ event: "test/event" }], handler);
    Reflect.defineMetadata(INNGEST_FUNCTION, { id: "test-fn" }, handler);
    setupDiscoveryMocks(handler);
  }

  async function mockConnection(close: () => Promise<void>) {
    const { connect } = await import("inngest/connect");
    vi.mocked(connect).mockResolvedValue({
      connectionId: "test-connection-123",
      close,
      closed: Promise.resolve(),
      state: "ACTIVE" as any,
      getDebugState: vi.fn(),
    });
  }

  const mockConsumer = () => ({ apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) });

  describe("Connect mode initialization", () => {
    it("should connect on application bootstrap, not in configure", async () => {
      const { connect } = await import("inngest/connect");

      module = createModule({
        mode: "connect",
        connectOptions: {
          instanceId: "test-worker-1",
          maxWorkerConcurrency: 5,
        },
      });
      setupHandler();

      const consumer = mockConsumer();
      await module.configure(consumer as any);

      expect(connect).not.toHaveBeenCalled();
      expect(consumer.apply).not.toHaveBeenCalled();

      await module.onApplicationBootstrap();

      // Verify connect was called
      expect(connect).toHaveBeenCalledWith(
        expect.objectContaining({
          apps: [{
            client: inngest,
            functions: expect.any(Array),
          }],
          handleShutdownSignals: [],
          instanceId: "test-worker-1",
          maxWorkerConcurrency: 5,
        })
      );
    });

    it("should use connect mode with default options when not specified", async () => {
      const { connect } = await import("inngest/connect");

      module = createModule({ mode: "connect" });
      setupHandler();

      await module.onApplicationBootstrap();

      // Verify connect was called without explicit options
      expect(connect).toHaveBeenCalledWith(
        expect.objectContaining({
          apps: [{
            client: inngest,
            functions: expect.any(Array),
          }],
        })
      );
    });

    it("should default to serve mode when mode is not specified", async () => {
      const { connect } = await import("inngest/connect");

      module = createModule({ path: "/api/inngest" });
      setupHandler();

      const consumer = mockConsumer();
      await module.configure(consumer as any);
      await module.onApplicationBootstrap();

      // Verify serve mode (consumer.apply) was called
      expect(consumer.apply).toHaveBeenCalledWith(expect.any(Function));
      expect(connect).not.toHaveBeenCalled();
    });

    it("should connect only after every onModuleInit hook has finished", async () => {
      const { connect } = await import("inngest/connect");
      const order: string[] = [];
      vi.mocked(connect).mockImplementation(async () => {
        order.push("connect");
        return {
          connectionId: "test-connection-123",
          close: vi.fn().mockResolvedValue(undefined),
          closed: Promise.resolve(),
          state: "ACTIVE" as any,
          getDebugState: vi.fn(),
        };
      });

      @Injectable()
      class SlowInitProvider implements OnModuleInit {
        async onModuleInit() {
          await new Promise((resolve) => setTimeout(resolve, 10));
          order.push("onModuleInit");
        }
      }

      @Module({
        imports: [InngestModule.forRoot({ inngest, mode: "connect" })],
        providers: [SlowInitProvider],
      })
      class AppModule {}

      const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
      try {
        expect(order).toEqual(["onModuleInit", "connect"]);
      } finally {
        await app.close();
      }
    });
  });

  describe("None mode", () => {
    it("should neither serve nor connect", async () => {
      const { connect } = await import("inngest/connect");

      module = createModule({ mode: "none" });
      setupHandler();

      const consumer = mockConsumer();
      await module.configure(consumer as any);
      await module.onApplicationBootstrap();

      expect(consumer.apply).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
      expect(discoveryService.controllerMethodsWithMetaAtKey).not.toHaveBeenCalled();

      await expect(worker.close()).resolves.toBeUndefined();
      await expect(module.onApplicationShutdown("SIGTERM")).resolves.toBeUndefined();
    });
  });

  describe("Connect mode shutdown", () => {
    it("should call close on application shutdown", async () => {
      const mockClose = vi.fn().mockResolvedValue(undefined);
      await mockConnection(mockClose);

      module = createModule({ mode: "connect" });
      setupHandler();

      await module.onApplicationBootstrap();

      // Trigger application shutdown
      await module.onApplicationShutdown();

      // Verify close was called
      expect(mockClose).toHaveBeenCalled();
    });

    it("should close once when drained before application shutdown", async () => {
      const mockClose = vi.fn().mockResolvedValue(undefined);
      await mockConnection(mockClose);

      module = createModule({ mode: "connect" });
      setupHandler();

      await module.onApplicationBootstrap();

      await Promise.all([worker.close({ signal: "SIGTERM" }), worker.close()]);
      await module.onApplicationShutdown("SIGTERM");

      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it("should stop waiting for the drain after the shutdown timeout", async () => {
      const mockClose = vi.fn(() => new Promise<void>(() => {}));
      await mockConnection(mockClose);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      module = createModule({ mode: "connect", shutdownTimeoutMs: 20 });
      setupHandler();

      await module.onApplicationBootstrap();

      await expect(worker.close()).resolves.toBeUndefined();

      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        "[Inngest] Error closing WebSocket connection:",
        expect.objectContaining({ message: "Connection close timed out after 20ms" }),
      );
    });

    it("should let close() override the configured shutdown timeout", async () => {
      const mockClose = vi.fn(() => new Promise<void>(() => {}));
      await mockConnection(mockClose);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      module = createModule({ mode: "connect", shutdownTimeoutMs: 60_000 });
      setupHandler();

      await module.onApplicationBootstrap();

      await expect(worker.close({ timeoutMs: 20 })).resolves.toBeUndefined();

      expect(consoleError).toHaveBeenCalledWith(
        "[Inngest] Error closing WebSocket connection:",
        expect.objectContaining({ message: "Connection close timed out after 20ms" }),
      );
    });

    it("should not error on shutdown in serve mode", async () => {
      module = createModule({ mode: "serve", path: "/api/inngest" });
      setupHandler();

      await module.configure(mockConsumer() as any);

      // Should not throw when shutting down in serve mode
      await expect(module.onApplicationShutdown()).resolves.not.toThrow();
    });
  });

  describe("Function discovery in connect mode", () => {
    it("should discover and register functions correctly", async () => {
      const { connect } = await import("inngest/connect");

      module = createModule({ mode: "connect" });

      const handler1 = function testHandler1() {};
      const handler2 = function testHandler2() {};

      Reflect.defineMetadata(INNGEST_TRIGGER, [{ event: "test/event1" }], handler1);
      Reflect.defineMetadata(INNGEST_FUNCTION, { id: "test-fn-1" }, handler1);
      Reflect.defineMetadata(INNGEST_TRIGGER, [{ event: "test/event2" }], handler2);
      Reflect.defineMetadata(INNGEST_FUNCTION, { id: "test-fn-2" }, handler2);

      const functionMethods = [
        mockDiscovered(handler1, { id: "test-fn-1" }),
        mockDiscovered(handler2, { id: "test-fn-2" })
      ];

      const triggerMethods = [
        mockDiscovered(handler1, [{ event: "test/event1" }]),
        mockDiscovered(handler2, [{ event: "test/event2" }])
      ];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        if (key === INNGEST_TRIGGER) return Promise.resolve(triggerMethods);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      await module.onApplicationBootstrap();

      // Verify connect was called with both functions
      expect(connect).toHaveBeenCalledWith(
        expect.objectContaining({
          apps: [{
            client: inngest,
            functions: expect.arrayContaining([
              expect.any(Object),
              expect.any(Object),
            ]),
          }],
        })
      );
    });
  });
});
