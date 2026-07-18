"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
global.window=global;
eval(fs.readFileSync("HybridTileStudioServicesV18.js","utf8"));
const services=global.HybridTileStudioServicesV18;
assert.equal(services.version,"18.1.0");

const starterQuest=JSON.parse(fs.readFileSync("examples/StarterQuest.htgquest","utf8"));
const quest=services.normalizeQuest(starterQuest), questReport=services.validateQuest(quest), questPayload=services.questPayload(quest,()=>"quest-hash");
assert.equal(questReport.ok,true);
assert.equal(questReport.visited,6);
assert.equal(questPayload.format,"HybridQuestProject");
assert.equal(questPayload.version,2);
assert.equal(questPayload.questHash,"quest-hash");
assert.equal(quest.edges.find(edge=>edge.from==="choose").label,"Gather supplies");

const starterRecipe=JSON.parse(fs.readFileSync("examples/StarterWorldRecipeGraph.htggraph","utf8"));
const recipe=services.normalizeRecipe(starterRecipe), recipePayload=services.recipePayload(recipe,()=>"graph-hash");
assert.equal(recipePayload.format,"HybridWorldRecipeGraph");
assert.equal(recipePayload.version,2);
assert.equal(recipePayload.nodes.length,starterRecipe.nodes.length);
assert.equal(recipePayload.graphHash,"graph-hash");

const starterContent=JSON.parse(fs.readFileSync("examples/StarterContentLibrary.htgcontent","utf8"));
const contentReport=services.validateContentLibrary(starterContent,{bytes:1024});
assert.equal(contentReport.ok,true);
assert.equal(contentReport.items.length,1);
assert.equal(services.contentPayload(contentReport.items).version,2);
assert.equal(services.validateContentLibrary(starterContent,{bytes:11*1024*1024}).ok,false);

const makeMap=value=>({width:2,height:1,tilesetId:1,data:new Array(12).fill(value),events:[null]});
const base=makeMap(0), draft=makeMap(0), current=makeMap(0);
draft.data[0]=10; current.data[1]=20; current.events.push({id:1,x:0,y:0});
const cleanMerge=services.mergeMapDraft(base,draft,current);
assert.equal(cleanMerge.ok,true);
assert.equal(cleanMerge.merged.data[0],10);
assert.equal(cleanMerge.merged.data[1],20);
assert.equal(cleanMerge.merged.events.length,2);
current.data[0]=30;
const conflict=services.mergeMapDraft(base,draft,current);
assert.equal(conflict.ok,false);
assert.deepEqual(conflict.conflicts[0],{type:"tile",index:0,base:0,draft:10,current:30});

const delta=services.mapDelta(base,draft);
assert.equal(delta.ok,true);
assert.deepEqual(delta.tiles,[{index:0,before:0,after:10}]);
const applied=services.applyMapDelta(makeMap(0),delta);
assert.equal(applied.ok,true);
assert.equal(applied.merged.data[0],10);
const rebasedCurrent=makeMap(0);rebasedCurrent.data[1]=20;
const rebased=services.mergeMapDelta(delta,rebasedCurrent);
assert.equal(rebased.ok,true);
assert.equal(rebased.merged.data[0],10);
assert.equal(rebased.merged.data[1],20);
const deltaConflictCurrent=makeMap(0);deltaConflictCurrent.data[0]=30;
const deltaConflict=services.mergeMapDelta(delta,deltaConflictCurrent);
assert.equal(deltaConflict.ok,false);
assert.deepEqual(deltaConflict.conflicts[0],{type:"tile",index:0,base:0,draft:10,current:30});
assert.equal(services.applyMapDelta({ ...makeMap(0), width:3 },delta).reason,"dimensions-changed");

function item(left,top){return {getBoundingClientRect(){return {left,top,width:10,height:10};}};}
const center=item(50,50), right=item(100,50), down=item(50,100), diagonal=item(90,90), items=[center,right,down,diagonal];
assert.equal(services.spatialNext(items,center,"right"),right);
assert.equal(services.spatialNext(items,center,"down"),down);
console.log("Hybrid Tile Studio v18.1 format, delta merge, and spatial services passed.");
