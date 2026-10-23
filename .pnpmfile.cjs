// tsup 9 calls the TypeScript compiler API directly when it builds the
// .d.ts output, and TypeScript 7 no longer ships that API. Give tsup the
// TypeScript 6 API package instead, so the project itself can use
// TypeScript 7 for type checking.
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "tsup" && pkg.peerDependencies?.typescript) {
        delete pkg.peerDependencies.typescript;
        if (pkg.peerDependenciesMeta)
          delete pkg.peerDependenciesMeta.typescript;
        pkg.dependencies = {
          ...pkg.dependencies,
          typescript: "npm:@typescript/typescript6@^6.0.2",
        };
      }
      return pkg;
    },
  },
};
