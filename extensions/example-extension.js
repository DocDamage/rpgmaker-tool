/* Hybrid Tile Studio v9 extension example. Load this script after HybridTileStudio.js. */
HybridTileStudio.registerExtension({ id: "example.checker", name: "Example Checker", version: "1.0.0" }, api => {
  api.registerValidator("example.empty-map", ({ map }) => map.data.some(Number) ? [] : [{ severity: "warning", message: "The map contains no non-zero tiles." }]);
  api.registerBrush("example.cross", ({ x, y, tileId, layer }) => [[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({ x:x+dx, y:y+dy, tileId, layer })));
});
