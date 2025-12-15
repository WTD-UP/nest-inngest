import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Inngest } from "inngest";
import "reflect-metadata";
import { InngestModule, INNGEST_TRIGGER, INNGEST_FUNCTION } from "../inngest.module";
import { DiscoveryService } from "@golevelup/nestjs-discovery";

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

  describe("Connect mode initialization", () => {
    it("should use connect mode when specified", async () => {
      const { connect } = await import("inngest/connect");
      
      module = new InngestModule(
        discoveryService,
        inngest,
        { 
          mode: "connect",
          connectOptions: {
            instanceId: "test-worker-1",
            maxWorkerConcurrency: 5,
          }
        }
      );

      const handler = function testHandler() {};
      Reflect.defineMetadata(INNGEST_TRIGGER, [{ event: "test/event" }], handler);
      Reflect.defineMetadata(INNGEST_FUNCTION, { id: "test-fn" }, handler);

      const functionMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: { id: "test-fn" },
      }];

      const triggerMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: [{ event: "test/event" }],
      }];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        if (key === INNGEST_TRIGGER) return Promise.resolve(triggerMethods);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

      // Verify connect was called
      expect(connect).toHaveBeenCalledWith(
        expect.objectContaining({
          apps: [{
            client: inngest,
            functions: expect.any(Array),
          }],
          instanceId: "test-worker-1",
          maxWorkerConcurrency: 5,
        })
      );

      // Verify serve was NOT called (consumer.apply should not be called)
      expect(mockConsumer.apply).not.toHaveBeenCalled();
    });

    it("should use connect mode with default options when not specified", async () => {
      const { connect } = await import("inngest/connect");
      
      module = new InngestModule(
        discoveryService,
        inngest,
        { mode: "connect" }
      );

      const handler = function testHandler() {};
      Reflect.defineMetadata(INNGEST_TRIGGER, [{ event: "test/event" }], handler);
      Reflect.defineMetadata(INNGEST_FUNCTION, { id: "test-fn" }, handler);

      const functionMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: { id: "test-fn" },
      }];

      const triggerMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: [{ event: "test/event" }],
      }];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        if (key === INNGEST_TRIGGER) return Promise.resolve(triggerMethods);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

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
      module = new InngestModule(
        discoveryService,
        inngest,
        { path: "/api/inngest" }
      );

      const handler = function testHandler() {};
      Reflect.defineMetadata(INNGEST_TRIGGER, [{ event: "test/event" }], handler);
      Reflect.defineMetadata(INNGEST_FUNCTION, { id: "test-fn" }, handler);

      const functionMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: { id: "test-fn" },
      }];

      const triggerMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: [{ event: "test/event" }],
      }];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        if (key === INNGEST_TRIGGER) return Promise.resolve(triggerMethods);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

      // Verify serve mode (consumer.apply) was called
      expect(mockConsumer.apply).toHaveBeenCalled();
      expect(mockConsumer.apply).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });

  describe("Connect mode shutdown", () => {
    it("should call close on application shutdown", async () => {
      const mockClose = vi.fn().mockResolvedValue(undefined);
      const { connect } = await import("inngest/connect");
      vi.mocked(connect).mockResolvedValue({
        connectionId: "test-connection-123",
        close: mockClose,
        closed: Promise.resolve(),
        state: "ACTIVE" as any,
      });

      module = new InngestModule(
        discoveryService,
        inngest,
        { mode: "connect" }
      );

      const handler = function testHandler() {};
      Reflect.defineMetadata(INNGEST_TRIGGER, [{ event: "test/event" }], handler);
      Reflect.defineMetadata(INNGEST_FUNCTION, { id: "test-fn" }, handler);

      const functionMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: { id: "test-fn" },
      }];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

      // Trigger application shutdown
      await module.onApplicationShutdown();

      // Verify close was called
      expect(mockClose).toHaveBeenCalled();
    });

    it("should not error on shutdown in serve mode", async () => {
      module = new InngestModule(
        discoveryService,
        inngest,
        { mode: "serve", path: "/api/inngest" }
      );

      const handler = function testHandler() {};
      Reflect.defineMetadata(INNGEST_TRIGGER, [{ event: "test/event" }], handler);
      Reflect.defineMetadata(INNGEST_FUNCTION, { id: "test-fn" }, handler);

      const functionMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: { id: "test-fn" },
      }];

      const triggerMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: [{ event: "test/event" }],
      }];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        if (key === INNGEST_TRIGGER) return Promise.resolve(triggerMethods);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

      // Should not throw when shutting down in serve mode
      await expect(module.onApplicationShutdown()).resolves.not.toThrow();
    });
  });

  describe("Function discovery in connect mode", () => {
    it("should discover and register functions correctly", async () => {
      const { connect } = await import("inngest/connect");
      
      module = new InngestModule(
        discoveryService,
        inngest,
        { mode: "connect" }
      );

      const handler1 = function testHandler1() {};
      const handler2 = function testHandler2() {};
      
      Reflect.defineMetadata(INNGEST_TRIGGER, [{ event: "test/event1" }], handler1);
      Reflect.defineMetadata(INNGEST_FUNCTION, { id: "test-fn-1" }, handler1);
      Reflect.defineMetadata(INNGEST_TRIGGER, [{ event: "test/event2" }], handler2);
      Reflect.defineMetadata(INNGEST_FUNCTION, { id: "test-fn-2" }, handler2);

      const functionMethods = [
        {
          discoveredMethod: {
            handler: handler1,
            parentClass: { instance: {} },
          },
          meta: { id: "test-fn-1" },
        },
        {
          discoveredMethod: {
            handler: handler2,
            parentClass: { instance: {} },
          },
          meta: { id: "test-fn-2" },
        }
      ];

      const triggerMethods = [
        {
          discoveredMethod: {
            handler: handler1,
            parentClass: { instance: {} },
          },
          meta: [{ event: "test/event1" }],
        },
        {
          discoveredMethod: {
            handler: handler2,
            parentClass: { instance: {} },
          },
          meta: [{ event: "test/event2" }],
        }
      ];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        if (key === INNGEST_TRIGGER) return Promise.resolve(triggerMethods);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

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

