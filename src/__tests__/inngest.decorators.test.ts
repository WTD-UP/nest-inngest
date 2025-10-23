import { describe, it, expect, beforeEach } from "vitest";
import { Inngest } from "inngest";
import "reflect-metadata";
import { NestInngest } from "../inngest.decorators";
import { INNGEST_TRIGGER, INNGEST_FUNCTION } from "../inngest.module";

describe("NestInngest Decorators", () => {
  let inngest: Inngest;
  let TestInngest: NestInngest<typeof inngest>;

  beforeEach(() => {
    inngest = new Inngest({ id: "test-app" });
    TestInngest = NestInngest.from(inngest);
  });

  describe("Function decorator", () => {
    it("should store function metadata", () => {
      class TestClass {
        @TestInngest.Function({ id: "test-function" })
        handler() {}
      }

      const instance = new TestClass();
      const metadata = Reflect.getMetadata(INNGEST_FUNCTION, instance.handler);

      expect(metadata).toEqual({ id: "test-function" });
    });
  });

  describe("Trigger decorator - single trigger", () => {
    it("should store single event trigger metadata", () => {
      class TestClass {
        @TestInngest.Trigger({ event: "test/event" })
        handler() {}
      }

      const instance = new TestClass();
      const metadata = Reflect.getMetadata(INNGEST_TRIGGER, instance.handler);

      expect(metadata).toEqual([{ event: "test/event" }]);
    });

    it("should store single cron trigger metadata", () => {
      class TestClass {
        @TestInngest.Trigger({ cron: "0 0 * * *" })
        handler() {}
      }

      const instance = new TestClass();
      const metadata = Reflect.getMetadata(INNGEST_TRIGGER, instance.handler);

      expect(metadata).toEqual([{ cron: "0 0 * * *" }]);
    });
  });

  describe("Trigger decorator - multiple triggers via variadic args", () => {
    it("should store multiple triggers from single decorator call", () => {
      class TestClass {
        @TestInngest.Trigger(
          { event: "test/event.created" },
          { cron: "0 2 * * *" }
        )
        handler() {}
      }

      const instance = new TestClass();
      const metadata = Reflect.getMetadata(INNGEST_TRIGGER, instance.handler);

      expect(metadata).toEqual([
        { event: "test/event.created" },
        { cron: "0 2 * * *" },
      ]);
    });

    it("should handle three or more triggers", () => {
      class TestClass {
        @TestInngest.Trigger(
          { event: "test/event.created" },
          { event: "test/event.updated" },
          { cron: "0 2 * * *" }
        )
        handler() {}
      }

      const instance = new TestClass();
      const metadata = Reflect.getMetadata(INNGEST_TRIGGER, instance.handler);

      expect(metadata).toEqual([
        { event: "test/event.created" },
        { event: "test/event.updated" },
        { cron: "0 2 * * *" },
      ]);
    });
  });

  describe("Trigger decorator - stacked decorators", () => {
    it("should accumulate triggers from multiple decorator calls", () => {
      class TestClass {
        @TestInngest.Trigger({ event: "test/event.created" })
        @TestInngest.Trigger({ cron: "0 2 * * *" })
        handler() {}
      }

      const instance = new TestClass();
      const metadata = Reflect.getMetadata(INNGEST_TRIGGER, instance.handler);

      expect(metadata).toEqual([
        { cron: "0 2 * * *" },
        { event: "test/event.created" },
      ]);
    });

    it("should accumulate three or more stacked decorators", () => {
      class TestClass {
        @TestInngest.Trigger({ event: "test/event.created" })
        @TestInngest.Trigger({ event: "test/event.updated" })
        @TestInngest.Trigger({ cron: "0 2 * * *" })
        handler() {}
      }

      const instance = new TestClass();
      const metadata = Reflect.getMetadata(INNGEST_TRIGGER, instance.handler);

      expect(metadata).toEqual([
        { cron: "0 2 * * *" },
        { event: "test/event.updated" },
        { event: "test/event.created" },
      ]);
    });
  });

  describe("Trigger decorator - mixed approaches", () => {
    it("should combine variadic and stacked decorators", () => {
      class TestClass {
        @TestInngest.Trigger(
          { event: "test/event.created" },
          { event: "test/event.updated" }
        )
        @TestInngest.Trigger({ cron: "0 2 * * *" })
        handler() {}
      }

      const instance = new TestClass();
      const metadata = Reflect.getMetadata(INNGEST_TRIGGER, instance.handler);

      expect(metadata).toEqual([
        { cron: "0 2 * * *" },
        { event: "test/event.created" },
        { event: "test/event.updated" },
      ]);
    });
  });

  describe("Combined Function and Trigger decorators", () => {
    it("should store both function and trigger metadata", () => {
      class TestClass {
        @TestInngest.Function({ id: "test-handler" })
        @TestInngest.Trigger({ event: "test/event" })
        handler() {}
      }

      const instance = new TestClass();
      const functionMetadata = Reflect.getMetadata(
        INNGEST_FUNCTION,
        instance.handler
      );
      const triggerMetadata = Reflect.getMetadata(
        INNGEST_TRIGGER,
        instance.handler
      );

      expect(functionMetadata).toEqual({ id: "test-handler" });
      expect(triggerMetadata).toEqual([{ event: "test/event" }]);
    });
  });
});
