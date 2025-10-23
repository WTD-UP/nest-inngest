"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  INNGEST_FUNCTION: () => INNGEST_FUNCTION,
  INNGEST_KEY: () => INNGEST_KEY,
  INNGEST_OPTIONS: () => INNGEST_OPTIONS,
  INNGEST_TRIGGER: () => INNGEST_TRIGGER,
  InngestModule: () => InngestModule,
  NestInngest: () => NestInngest
});
module.exports = __toCommonJS(src_exports);

// src/inngest.module.ts
var import_common = require("@nestjs/common");
var import_nestjs_discovery = require("@golevelup/nestjs-discovery");
var import_inngest = require("inngest");
var import_express = require("inngest/express");
function _ts_decorate(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if (d = decorators[i])
        r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
__name(_ts_decorate, "_ts_decorate");
function _ts_metadata(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
}
__name(_ts_metadata, "_ts_metadata");
function _ts_param(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
}
__name(_ts_param, "_ts_param");
var INNGEST_KEY = "INNGEST";
var INNGEST_OPTIONS = "INNGEST_OPTIONS";
var INNGEST_FUNCTION = "INNGEST_FUNCTION";
var INNGEST_TRIGGER = "INNGEST_TRIGGER";
function dedupeTriggers(triggers) {
  const seen = /* @__PURE__ */ new Set();
  return triggers.filter((trigger) => {
    const key = JSON.stringify(trigger);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
__name(dedupeTriggers, "dedupeTriggers");
var InngestModule = class _InngestModule {
  static {
    __name(this, "InngestModule");
  }
  discover;
  inngest;
  options;
  constructor(discover, inngest, options) {
    this.discover = discover;
    this.inngest = inngest;
    this.options = options;
  }
  static forRoot({ inngest, ...options }) {
    return {
      imports: [
        import_nestjs_discovery.DiscoveryModule
      ],
      module: _InngestModule,
      providers: [
        {
          provide: INNGEST_KEY,
          useValue: inngest
        },
        {
          provide: INNGEST_OPTIONS,
          useValue: options
        }
      ],
      exports: [],
      global: true
    };
  }
  async configure(consumer) {
    const [functions, triggers] = await Promise.all([
      Promise.all([
        this.discover.controllerMethodsWithMetaAtKey(INNGEST_FUNCTION),
        this.discover.providerMethodsWithMetaAtKey(INNGEST_FUNCTION)
      ]),
      Promise.all([
        this.discover.controllerMethodsWithMetaAtKey(INNGEST_TRIGGER),
        this.discover.providerMethodsWithMetaAtKey(INNGEST_TRIGGER)
      ])
    ]);
    const handlers = functions.flat().map((func) => {
      const triggerMeta = triggers.flat().filter((each) => each.discoveredMethod.handler === func.discoveredMethod.handler).flatMap((each) => each.meta).filter(Boolean);
      const uniqueTriggers = dedupeTriggers(triggerMeta);
      const triggerArg = uniqueTriggers.length === 0 ? void 0 : uniqueTriggers.length === 1 ? uniqueTriggers[0] : uniqueTriggers;
      return this.inngest.createFunction(
        // @ts-ignore
        func.meta,
        triggerArg,
        func.discoveredMethod.handler.bind(func.discoveredMethod.parentClass.instance)
      );
    });
    consumer.apply((0, import_express.serve)({
      client: this.inngest,
      functions: handlers
    })).forRoutes(this.options.path ?? "/api/inngest");
  }
};
InngestModule = _ts_decorate([
  _ts_param(0, (0, import_common.Inject)(import_nestjs_discovery.DiscoveryService)),
  _ts_param(1, (0, import_common.Inject)(INNGEST_KEY)),
  _ts_param(2, (0, import_common.Inject)(INNGEST_OPTIONS)),
  _ts_metadata("design:type", Function),
  _ts_metadata("design:paramtypes", [
    typeof import_nestjs_discovery.DiscoveryService === "undefined" ? Object : import_nestjs_discovery.DiscoveryService,
    typeof import_inngest.Inngest === "undefined" ? Object : import_inngest.Inngest,
    typeof Omit === "undefined" ? Object : Omit
  ])
], InngestModule);

// src/inngest.decorators.ts
var NestInngest = class _NestInngest {
  static {
    __name(this, "NestInngest");
  }
  inngest;
  constructor(inngest) {
    this.inngest = inngest;
  }
  static from(inngest) {
    return new _NestInngest(inngest);
  }
  /**
  * Inngest function decorator
  */
  Function(args) {
    return (target, key, descriptor) => {
      Reflect.defineMetadata(INNGEST_FUNCTION, args, descriptor.value);
      return descriptor;
    };
  }
  /**
  * Inngest function trigger decorator
  * Supports single or multiple triggers via variadic arguments or stacked decorators
  */
  Trigger(...configs) {
    return (target, key, descriptor) => {
      const existing = Reflect.getMetadata(INNGEST_TRIGGER, descriptor.value) ?? [];
      const normalized = configs.flat();
      Reflect.defineMetadata(INNGEST_TRIGGER, [
        ...existing,
        ...normalized
      ], descriptor.value);
      return descriptor;
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  INNGEST_FUNCTION,
  INNGEST_KEY,
  INNGEST_OPTIONS,
  INNGEST_TRIGGER,
  InngestModule,
  NestInngest
});
//# sourceMappingURL=index.js.map