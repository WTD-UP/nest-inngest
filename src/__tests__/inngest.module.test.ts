import { describe, it, expect, vi, beforeEach } from "vitest";
import { Inngest } from "inngest";
import "reflect-metadata";
import { InngestModule, INNGEST_TRIGGER, INNGEST_FUNCTION } from "../inngest.module";
import { DiscoveryService } from "@golevelup/nestjs-discovery";

describe("InngestModule - Multi-Trigger Support", () => {
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

    module = new InngestModule(
      discoveryService,
      inngest,
      { path: "/api/inngest" }
    );
  });

  describe("Trigger aggregation", () => {
    it("should handle single trigger via @Trigger decorator", async () => {
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

      const createFunctionSpy = vi.spyOn(inngest, "createFunction");
      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

      // v4: 2-arg call with triggers merged into config
      expect(createFunctionSpy).toHaveBeenCalledWith(
        { id: "test-fn", triggers: { event: "test/event" } },
        expect.any(Function)
      );
    });

    it("should handle triggers in @Function config (v4 native)", async () => {
      const handler = function testHandler() {};

      // No @Trigger metadata — triggers are in the @Function config
      Reflect.defineMetadata(INNGEST_FUNCTION, {
        id: "test-fn",
        triggers: [{ event: "test/event" }],
      }, handler);

      const functionMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: { id: "test-fn", triggers: [{ event: "test/event" }] },
      }];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        if (key === INNGEST_TRIGGER) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const createFunctionSpy = vi.spyOn(inngest, "createFunction");
      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

      expect(createFunctionSpy).toHaveBeenCalledWith(
        { id: "test-fn", triggers: { event: "test/event" } },
        expect.any(Function)
      );
    });

    it("should aggregate multiple triggers into array", async () => {
      const handler = function testHandler() {};

      Reflect.defineMetadata(
        INNGEST_TRIGGER,
        [
          { event: "test/event.created" },
          { cron: "0 2 * * *" }
        ],
        handler
      );
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
        meta: [
          { event: "test/event.created" },
          { cron: "0 2 * * *" }
        ],
      }];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        if (key === INNGEST_TRIGGER) return Promise.resolve(triggerMethods);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const createFunctionSpy = vi.spyOn(inngest, "createFunction");
      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

      expect(createFunctionSpy).toHaveBeenCalledWith(
        {
          id: "test-fn",
          triggers: [
            { event: "test/event.created" },
            { cron: "0 2 * * *" }
          ],
        },
        expect.any(Function)
      );
    });

    it("should deduplicate identical triggers", async () => {
      const handler = function testHandler() {};

      Reflect.defineMetadata(
        INNGEST_TRIGGER,
        [
          { event: "test/event" },
          { event: "test/event" }, // Duplicate
          { cron: "0 2 * * *" }
        ],
        handler
      );
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
        meta: [
          { event: "test/event" },
          { event: "test/event" },
          { cron: "0 2 * * *" }
        ],
      }];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        if (key === INNGEST_TRIGGER) return Promise.resolve(triggerMethods);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const createFunctionSpy = vi.spyOn(inngest, "createFunction");
      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

      expect(createFunctionSpy).toHaveBeenCalledWith(
        {
          id: "test-fn",
          triggers: [
            { event: "test/event" },
            { cron: "0 2 * * *" }
          ],
        },
        expect.any(Function)
      );
    });

    it("should handle functions with no triggers", async () => {
      const handler = function testHandler() {};

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
        if (key === INNGEST_TRIGGER) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const createFunctionSpy = vi.spyOn(inngest, "createFunction");
      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

      expect(createFunctionSpy).toHaveBeenCalledWith(
        { id: "test-fn", triggers: undefined },
        expect.any(Function)
      );
    });

    it("should preserve trigger order", async () => {
      const handler = function testHandler() {};

      Reflect.defineMetadata(
        INNGEST_TRIGGER,
        [
          { event: "test/first" },
          { event: "test/second" },
          { event: "test/third" }
        ],
        handler
      );
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
        meta: [
          { event: "test/first" },
          { event: "test/second" },
          { event: "test/third" }
        ],
      }];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        if (key === INNGEST_TRIGGER) return Promise.resolve(triggerMethods);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const createFunctionSpy = vi.spyOn(inngest, "createFunction");
      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

      expect(createFunctionSpy).toHaveBeenCalledWith(
        {
          id: "test-fn",
          triggers: [
            { event: "test/first" },
            { event: "test/second" },
            { event: "test/third" }
          ],
        },
        expect.any(Function)
      );
    });

    it("should merge triggers from config and @Trigger decorator", async () => {
      const handler = function testHandler() {};

      // @Trigger decorator adds one trigger
      Reflect.defineMetadata(INNGEST_TRIGGER, [{ cron: "0 2 * * *" }], handler);
      // @Function config also has a trigger
      Reflect.defineMetadata(INNGEST_FUNCTION, {
        id: "test-fn",
        triggers: [{ event: "test/event" }],
      }, handler);

      const functionMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: { id: "test-fn", triggers: [{ event: "test/event" }] },
      }];

      const triggerMethods = [{
        discoveredMethod: {
          handler,
          parentClass: { instance: {} },
        },
        meta: [{ cron: "0 2 * * *" }],
      }];

      vi.mocked(discoveryService.controllerMethodsWithMetaAtKey).mockImplementation((key) => {
        if (key === INNGEST_FUNCTION) return Promise.resolve(functionMethods);
        if (key === INNGEST_TRIGGER) return Promise.resolve(triggerMethods);
        return Promise.resolve([]);
      });

      vi.mocked(discoveryService.providerMethodsWithMetaAtKey).mockResolvedValue([]);

      const createFunctionSpy = vi.spyOn(inngest, "createFunction");
      const mockConsumer = { apply: vi.fn().mockReturnValue({ forRoutes: vi.fn() }) };

      await module.configure(mockConsumer as any);

      expect(createFunctionSpy).toHaveBeenCalledWith(
        {
          id: "test-fn",
          triggers: [
            { event: "test/event" },
            { cron: "0 2 * * *" },
          ],
        },
        expect.any(Function)
      );
    });
  });
});
