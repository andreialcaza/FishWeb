import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AdventureSave, FINAL_ADVENTURE_TANK } from "../dist/src/adventure-save.js";
import { SOUND_FILES } from "../dist/src/audio.js";
import { parseFishSong } from "../dist/src/fish-song.js";
import { createFish } from "../dist/src/fish.js";
import { PET_TYPES } from "../dist/src/pets.js";
import { GameRecords, formatTime } from "../dist/src/records.js";
import { SANDBOX_ALIENS, SANDBOX_FISH, Tank, TICK_MS } from "../dist/src/simulation.js";
import { resaleValue, VirtualTankSave } from "../dist/src/virtual-tank.js";

const random = () => 0.4;

test("every packaged sound effect has complete, aligned WAV chunks", async () => {
  for (const sample of SOUND_FILES) {
    const wave = await readFile(new URL(`../dist/sounds/${sample}.wav`, import.meta.url));
    assert.equal(wave.toString("ascii", 0, 4), "RIFF", sample);
    assert.equal(wave.readUInt32LE(4), wave.length - 8, sample);
    assert.equal(wave.toString("ascii", 8, 12), "WAVE", sample);
    let hasSamples = false;
    let offset = 12;
    while (offset + 8 <= wave.length) {
      const size = wave.readUInt32LE(offset + 4);
      if (wave.toString("ascii", offset, offset + 4) === "data") hasSamples = size > 0;
      offset += 8 + size + size % 2;
    }
    assert.equal(offset, wave.length, sample);
    assert.ok(hasSamples, sample);
  }
});

function virtualProfile() {
  const values = new Map();
  const storage = () => ({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  const date = new Date(2026, 10, 23, 12);
  const load = () => new VirtualTankSave(() => date.getTime(), storage, random);
  return { load, tomorrow() { date.setDate(date.getDate() + 1); } };
}

test("Virtual Tank stock is daily, sells each slot once, and preserves purchases across sessions", () => {
  const { load, tomorrow } = virtualProfile();
  const tank = load();
  assert.equal(tank.shells, 200);
  assert.equal(tank.fish.length, 0);
  const stock = tank.catalog();
  assert.equal(stock.length, 8);
  assert.equal(stock[0].item.price, 25);
  assert.equal(stock[1].item.price, 100);
  assert.match(tank.purchase(stock[0], "  "), /choose a name/);
  assert.match(tank.purchase(stock[2]), /more shells/);
  assert.equal(tank.purchase(stock[0], "  Bubbles "), undefined);
  assert.equal(tank.shells, 175);
  assert.match(tank.purchase(stock[0], "Duplicate"), /sold out/);

  const restored = load();
  assert.equal(restored.fish[0].name, "Bubbles");
  assert.equal(restored.catalog()[0].sold, true);
  assert.deepEqual(restored.catalog().slice(1), stock.slice(1));
  assert.equal(resaleValue(restored.fish[0], restored.now()), 25);

  tomorrow();
  assert.equal(restored.catalog()[0].sold, false);
  assert.match(restored.purchase(stock[0], "Yesterday"), /new stock/);
  assert.equal(resaleValue(restored.fish[0], restored.now()), 12);
  restored.renameFish(restored.fish[0].id, "Goldie");
  restored.showFish(restored.fish[0].id, false);
  assert.equal(load().fish[0].name, "Goldie");
  assert.equal(load().fish[0].shown, false);
  restored.sellFish(restored.fish[0].id);
  assert.equal(load().fish.length, 0);
  assert.equal(load().shells, 187);
});

test("Virtual Tank meals grow immortal fish, cap daily care, and pay in shells", () => {
  const { load, tomorrow } = virtualProfile();
  const save = load();
  save.purchase(save.catalog()[0], "Bubbles");
  const tank = new Tank(random, { virtualTank: save });
  assert.equal(tank.mode, "virtual");
  assert.equal(tank.shop.slots.length, 0);
  assert.equal(tank.alienSystem.hasScheduledWave, false);
  const [fish] = tank.state.fish;
  function feed() {
    fish.x = 300;
    fish.y = 160;
    fish.fullness = 100;
    assert.equal(tank.click(300, 160), "food");
    tank.step();
  }
  feed();
  feed();
  feed();
  feed();
  assert.equal(save.fish[0].mood, 4);
  assert.equal(save.fish[0].fedToday, 3);
  assert.equal(save.fish[0].meals, 3);
  assert.equal(tank.state.money, 175);
  for (let day = 0; day < 4; day++) {
    tomorrow();
    save.updateDay();
    feed();
    feed();
    feed();
  }
  assert.equal(fish.stage, 1);
  assert.equal(load().fish[0].stage, 1);
  assert.equal(load().fish[0].mood, 6);

  fish.coinTicks = fish.coinInterval;
  tank.step();
  const [shell] = tank.state.coins;
  assert.equal(shell.value, 5);
  assert.equal(tank.click(shell.x, shell.y), "coin");
  assert.equal(load().shells, 180);
  fish.fullness = -1000;
  tank.step();
  assert.equal(tank.state.fish[0], fish);
  assert.equal(tank.state.status, "playing");
});

test("Virtual Tank requires the right special food and saves equipment, backdrops, and pets", () => {
  const { load, tomorrow } = virtualProfile();
  const save = load();
  save.purchase(save.catalog()[1], "Chomper");
  const tank = new Tank(random, { virtualTank: save });
  assert.deepEqual(tank.specialFoodNeeded(), [0]);
  assert.equal(tank.feedSpecial(0), true);
  assert.equal(tank.feedSpecial(0), false);
  assert.equal(tank.state.fish.find((fish) => fish.kind === "guppy").virtual, false);
  assert.equal(tank.state.money, 100);

  save.earn(100000);
  save.configure({ showAttractor: true });
  assert.equal(save.settings.showAttractor, false);
  assert.equal(save.purchase(save.catalog()[2]), undefined);
  assert.equal(save.capacity, 20);
  assert.equal(save.settings.showBubbulator, true);
  assert.equal(save.catalog()[2].sold, true);
  assert.equal(save.catalog()[2].item.type, "bubbulator");
  assert.equal(save.purchase(save.catalog()[7]), undefined);
  assert.ok(save.background > 1);
  save.cycleBackground(-1);
  assert.equal(save.background, 1);
  save.sellBackground(1);
  assert.equal(save.shells, 75100);
  tomorrow();
  assert.equal(save.purchase(save.catalog()[2]), undefined);
  tank.syncVirtualTank();
  assert.equal(tank.alienSystem.hasScheduledWave, true);
  save.configure({ showAttractor: false });
  tank.syncVirtualTank();
  assert.equal(tank.alienSystem.hasScheduledWave, false);
  tomorrow();
  assert.equal(save.purchase(save.catalog()[2]), undefined);
  save.choosePets(["stinky", "prego", "zorf", "niko"]);
  const restored = load();
  assert.deepEqual(restored.pets, ["stinky", "prego", "zorf"]);
  assert.equal(restored.foodLevel, 2);
  assert.equal(restored.settings.showAttractor, false);
  assert.equal(restored.backgrounds.length, 1);
});

test("Niko uses the desktop position for each Adventure tank backdrop", () => {
  const positions = [[135, 213], [215, 123], [185, 220], [107, 145], [200, 136]];
  for (const [index, position] of positions.entries()) {
    const tank = new Tank(random, { tank: index + 1, pets: ["niko"] });
    const niko = tank.state.pets.find((pet) => pet.type === "niko");
    assert.deepEqual([niko.x, niko.y], position, `Tank ${index + 1}`);
  }
});

test("Niko and its pearl move together when the Virtual Tank backdrop rotates", () => {
  const save = virtualProfile().load();
  save.choosePets(["niko"]);
  const tank = new Tank(random, { virtualTank: save });
  const [niko] = tank.state.pets;
  niko.timer = 1232;
  tank.step();
  const [pearl] = tank.state.coins;
  assert.equal(pearl.kind, "niko-pearl");
  const offset = [pearl.x - niko.x, pearl.y - niko.y];

  tank.virtualDisplayBackground = 3;
  tank.syncVirtualTank();
  assert.deepEqual([niko.x, niko.y], [105, 116]);
  assert.deepEqual([pearl.x - niko.x, pearl.y - niko.y], offset);

  tank.virtualDisplayBackground = undefined;
  tank.syncVirtualTank();
  assert.deepEqual([niko.x, niko.y], [135, 213]);
  assert.equal(tank.click(pearl.x, pearl.y), "coin");
  assert.equal(niko.pearlTaken, true);
});

test("Adventure's postgame shell round skips tank failure and applies same-shell combos", () => {
  const tank = new Tank(random, { tank: 1 });
  tank.startShellBonus();
  assert.equal(tank.state.fish.length, 0);
  assert.equal(tank.bonusSecondsLeft, 10);
  for (let i = 0; i < 10; i++) tank.step();
  const first = tank.state.coins[0];
  assert.equal(tank.click(first.x, first.y), "coin");
  assert.equal(tank.state.money, first.value);
  for (let i = 0; i < 10; i++) tank.step();
  const second = tank.state.coins[0];
  assert.equal(tank.click(second.x, second.y), "coin");
  assert.equal(tank.state.money, first.value + second.value * 2);
  for (let i = 0; i < 700; i++) tank.step();
  assert.equal(tank.state.status, "complete");
});

test("Hall of Fame ranks completed runs and keeps pre-existing personal bests", () => {
  const saved = new Map([
    ["winfish:time-trial:best:1", "1200"],
    ["winfish:challenge:best:2", "270"],
  ]);
  const storage = () => ({
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  const records = new GameRecords(storage);
  assert.equal(records.record("time-trial", 1, 850), 1200);
  for (const score of [400, 700, 700, 4000, 900]) records.record("time-trial", 1, score);
  for (const score of [300, 160, 180, 260, 280]) records.record("challenge", 2, score);
  for (const score of [45, 60, 43]) records.record("adventure", 2, score, 3);
  for (const score of [11, 17, 13, 14]) records.record("adventure", 5, score);

  const reloaded = new GameRecords(storage);
  assert.deepEqual(reloaded.scores("time-trial", 1), [4000, 1200, 900, 850, 700]);
  assert.deepEqual(reloaded.scores("challenge", 2), [160, 180, 260, 270, 280]);
  assert.deepEqual(reloaded.scores("adventure", 2, 3), [43]);
  assert.deepEqual(reloaded.scores("adventure", 5), [17, 14, 13]);
  assert.equal(reloaded.best("adventure", 2, 4), undefined);
  assert.equal(formatTime(3661), "1:01:01");
});

test("Hall of Fame keeps session records when browser storage is unavailable", () => {
  const records = new GameRecords(() => { throw new Error("Storage unavailable"); });
  assert.equal(records.record("challenge", 1, 400), 400);
  assert.equal(records.record("challenge", 1, 240), 240);
  assert.deepEqual(records.scores("challenge", 1), [240, 400]);
});

test("Adventure saves independent tank progress, out-of-order rewards, and lineups across sessions", () => {
  let stored = null;
  const storage = () => ({ getItem: () => stored, setItem: (_, value) => { stored = value; } });
  const save = new AdventureSave(storage);
  assert.deepEqual(save.unlockedPets, []);
  assert.deepEqual(save.completeLevel(4, 1), ["nimbus"]);
  save.savePets(4, ["nimbus"]);
  assert.deepEqual(save.completeLevel(2, 1), ["clyde"]);
  save.savePets(2, ["clyde", "nimbus"]);
  assert.deepEqual(save.completeLevel(4, 2), ["amp"]);
  assert.deepEqual(save.completeLevel(4, 2), []);
  assert.deepEqual(save.completeLevel(4, 4), []);

  const reloaded = new AdventureSave(storage);
  assert.deepEqual([1, 2, 3, 4, 5].map((tank) => reloaded.level(tank)), [1, 2, 1, 3, 1]);
  assert.deepEqual(reloaded.pets(4), ["nimbus"]);
  assert.deepEqual(reloaded.pets(2), ["clyde", "nimbus"]);
  assert.deepEqual(reloaded.unlockedPets, ["clyde", "nimbus", "amp"]);
  assert.equal(save.message, "");
});

test("Adventure migrates old sequential saves, including progress before pet selection", () => {
  const checkpoint = { stage: "next", tank: 3, level: 1, pets: ["stinky", "niko", "zorf"] };
  let stored = JSON.stringify({ version: 1, checkpoint });
  const storage = () => ({ getItem: () => stored, setItem: (_, value) => { stored = value; } });
  const save = new AdventureSave(storage);
  assert(save.isComplete(1));
  assert(save.isComplete(2));
  assert(!save.isComplete(3));
  assert.equal(save.level(3), 1);
  assert.deepEqual(save.pets(3), checkpoint.pets);
  assert.deepEqual(save.unlockedPets, PET_TYPES.slice(0, 10));
  assert.deepEqual(save.completeLevel(4, 1), ["nimbus"]);
  assert.equal(JSON.parse(stored).version, 2);
  assert.equal(new AdventureSave(storage).level(4), 2);
  assert.deepEqual(new AdventureSave(storage).pets(3), checkpoint.pets);

  stored = JSON.stringify({ version: 1, checkpoint: { stage: "complete" } });
  const finished = new AdventureSave(storage);
  assert(finished.finalUnlocked);
  assert(finished.isComplete(FINAL_ADVENTURE_TANK));
  assert.equal(finished.unlockedPets.at(-1), "presto");
});

test("Cyrax unlocks after all regular tanks are clear and awards Presto only once", () => {
  let stored = null;
  const storage = () => ({ getItem: () => stored, setItem: (_, value) => { stored = value; } });
  const save = new AdventureSave(storage);
  for (const tank of [4, 2, 3, 1]) {
    for (let level = 1; level < 5; level++) {
      assert.deepEqual(save.completeLevel(tank, level), [PET_TYPES[(tank - 1) * 5 + level - 1]]);
    }
    assert.equal(save.finalUnlocked, false);
    assert.deepEqual(save.completeLevel(FINAL_ADVENTURE_TANK, 1), []);
    const rewards = tank === 4 ? [] : tank === 1 ? ["zorf", "cyrax"] : [PET_TYPES[tank * 5 - 1]];
    assert.deepEqual(save.completeLevel(tank, 5), rewards);
  }
  const reloaded = new AdventureSave(storage);
  assert(reloaded.finalUnlocked);
  assert.deepEqual(reloaded.unlockedPets, PET_TYPES.slice(0, 19));
  assert.deepEqual(reloaded.completeLevel(4, 5), []);
  assert.deepEqual(reloaded.completeLevel(FINAL_ADVENTURE_TANK, 1), ["presto"]);
  assert.deepEqual(reloaded.completeLevel(FINAL_ADVENTURE_TANK, 1), []);
  assert.deepEqual(new AdventureSave(storage).unlockedPets, PET_TYPES.slice(0, 20));
});

test("invalid Adventure saves and unavailable browser storage allow in-memory play", () => {
  let stored = "{";
  const storage = () => ({ getItem: () => stored, setItem: (_, value) => { stored = value; } });
  const corrupt = new AdventureSave(storage);
  assert.equal(corrupt.started, false);
  assert.match(corrupt.message, /could not be loaded/);
  assert.deepEqual(corrupt.completeLevel(2, 1), ["clyde"]);
  assert.equal(corrupt.message, "");
  assert.equal(new AdventureSave(storage).level(2), 2);

  const unavailable = new AdventureSave(() => { throw new Error("Storage unavailable"); });
  assert.equal(unavailable.started, false);
  assert.deepEqual(unavailable.completeLevel(4, 1), ["nimbus"]);
  assert.equal(unavailable.level(4), 2);
  assert.match(unavailable.message, /could not be saved/);
});

test("an older tab cannot overwrite newer Adventure progress", () => {
  let stored = null;
  const storage = () => ({ getItem: () => stored, setItem: (_, value) => { stored = value; } });
  const older = new AdventureSave(storage);
  const newer = new AdventureSave(storage);
  newer.completeLevel(3, 1);
  older.completeLevel(1, 1);
  assert.match(older.message, /changed in another tab/);
  const reloaded = new AdventureSave(storage);
  assert.equal(reloaded.level(3), 2);
  assert.equal(reloaded.level(1), 1);
});

test("desktop sound cues follow successful tank actions and alien waves", () => {
  const played = [];
  const tank = new Tank(random, { sandbox: true, playSound: (sound) => played.push(sound) });
  assert.equal(tank.click(300, 60), "food");
  assert.equal(tank.click(310, 60), "food-limit");
  assert.deepEqual(played.splice(0), ["dropfood"]);
  tank.buy("egg");
  assert.deepEqual(played.splice(0), ["hatch", "buy"]);

  tank.alienSystem.schedule(["gus"], 2);
  tank.step();
  tank.step();
  const [gus] = tank.alienSystem.aliens;
  tank.alienSystem.damage(gus, gus.health);
  assert.deepEqual(played, ["awooga", "guffaw", "explode", "explosion1"]);
});

test("a carnivore eating a guppy produces chomp bursts at the prey", () => {
  const tank = new Tank(random, { sandbox: true });
  const predator = createFish("oscar", 300, 180, 1, random);
  const prey = createFish("guppy", 310, 180, 1, random);
  predator.fullness = 100;
  tank.state.fish.splice(0, tank.state.fish.length, predator, prey);

  tank.step();

  assert.deepEqual(tank.state.fish, [predator]);
  assert.equal(tank.state.deadFish.length, 0);
  assert.equal(tank.state.fishChomps.length, 3);
  for (const burst of tank.state.fishChomps) {
    assert.ok(Math.abs(burst.x - 310) < 10 && Math.abs(burst.y - 180) < 10);
    assert.equal(burst.startTick, tank.state.tick);
  }
});

test("the final fish's chomp animation finishes before the tank fails", () => {
  const tank = new Tank(random, { level: 2 });
  const [prey, starving] = tank.state.fish;
  starving.fullness = 0;
  tank.step();
  assert.equal(tank.state.deadFish.length, 1);
  assert.equal(tank.state.fishChomps.length, 0);

  tank.alienSystem.spawn("weak-sylv", prey.x, prey.y);
  const [alien] = tank.alienSystem.aliens;
  alien.spawnTicks = alien.chaseDelay = 0;
  tank.step();
  assert.equal(tank.state.fish.length, 0);
  assert.equal(tank.state.fishChomps.length, 3);
  for (let i = 0; i < 10; i++) tank.step();
  assert.equal(tank.state.status, "playing");
  assert.equal(tank.state.fishChomps.length, 3);
  tank.step();
  assert.equal(tank.state.fishChomps.length, 0);
  assert.equal(tank.state.status, "failed");
});

test("fish songs preserve chords, channel shifts, rests, and tempo", () => {
  const song = parseFishSong(`
*attrib title = Test song
*speed 2
c4 0, g4 qt, r s
*line 2
*localshift -12
*volume 0.5
*rest 1
bb4 s+s+
`);
  assert.deepEqual(song, {
    title: "Test song",
    duration: 136,
    notes: [
      { at: 0, pitch: 0, volume: 1 },
      { at: 0, pitch: 7, volume: 1 },
      { at: 88, pitch: -2, volume: 0.5 },
    ],
  });
});

test("food and shop purchases unlock and charge once", () => {
  const tank = new Tank(random, { tank: 2, level: 2 });
  assert.equal(tank.buy("potion"), "locked");
  tank.shop.onGrow("guppy", 2);
  tank.state.money = 1500;
  assert.equal(tank.buy("potion"), "bought");
  assert.equal(tank.shop.getSlot("potion").maxed, false);
  assert.equal(tank.buy("potion"), "pending");
  assert.equal(tank.click(300, 60), "food");
  assert.equal(tank.state.food[0].level, 3);
  assert.equal(tank.click(310, 60), "food-limit");
  assert.equal(tank.state.money, 1250);
  assert.equal(tank.buy("penta"), "bought");
  assert.equal(tank.state.fish.at(-1).kind, "penta");
  assert.equal(tank.shop.getSlot("weapon").unlocked, true);
  assert.equal(tank.shop.getSlot("egg").unlocked, true);
  assert.equal(tank.buy("egg"), "no-money");
  assert.equal(tank.shop.eggPieces, 0);
  assert.equal(tank.buy("potion"), "bought");
});

test("food and laser upgrades sell out at their desktop limits", () => {
  const tank = new Tank(random, { sandbox: true });
  for (const [id, property, cap] of [
    ["quality", "foodLevel", 2],
    ["quantity", "foodLimit", 9],
    ["weapon", "weaponPower", 12],
  ]) {
    const { price } = tank.shop.getSlot(id);
    for (let level = tank.shop[property]; level < cap; level++) {
      assert.equal(tank.shop.getSlot(id).maxed, false);
      const balance = tank.state.money;
      assert.equal(tank.buy(id), "bought");
      assert.equal(tank.state.money, balance - price);
      assert.equal(tank.shop[property], level + 1);
    }
    const balance = tank.state.money;
    assert.equal(tank.shop.getSlot(id).maxed, true);
    assert.equal(tank.buy(id), "maxed");
    assert.equal(tank.shop[property], cap);
    assert.equal(tank.state.money, balance);
  }
});

test("a finishing laser shot between ticks unlocks the Cyrax egg", () => {
  const tank = new Tank(random, { tank: 5 });
  assert.equal(tank.state.pets.length, 18);
  for (let step = 0; step < 322; step++) tank.step();
  const cyrax = tank.alienSystem.aliens.find((alien) => alien.kind === "cyrax");
  assert.ok(cyrax);
  assert.equal(tank.shop.getSlot("egg").unlocked, false);
  tank.alienSystem.damage(cyrax, cyrax.health - 10);
  assert.equal(tank.click(cyrax.x, cyrax.y), "shot");
  assert.equal(tank.alienSystem.battleActive, false);
  tank.step();
  assert.equal(tank.shop.getSlot("egg").unlocked, true);
  assert.equal(tank.buy("egg"), "bought");
  assert.equal(tank.state.status, "complete");
});

test("sandbox can run the complete roster", () => {
  const tank = new Tank(random, { sandbox: true });
  const fish = Object.keys(SANDBOX_FISH);
  const aliens = Object.keys(SANDBOX_ALIENS);
  for (const kind of fish) tank.spawnSandboxFish(kind);
  for (const kind of PET_TYPES) tank.spawnSandboxPet(kind);
  for (const kind of aliens) tank.spawnSandboxAlien(kind);
  assert.deepEqual(new Set(tank.state.fish.map((fish) => fish.kind)), new Set(fish));
  assert.equal(tank.state.pets.length, PET_TYPES.length);
  assert.equal(tank.alienSystem.aliens.length, aliens.length);
  for (let step = 0; step < 1000; step++) tank.step();
  assert.equal(tank.state.status, "playing");
});

test("sandbox eggs hatch missing pets for free and leave the tank running", () => {
  const tank = new Tank(random, { sandbox: true, tank: 5 });
  tank.spawnSandboxPet("presto");
  tank.changePresto("itchy");
  assert.equal(tank.state.pets[0].type, "itchy");
  assert.equal(tank.shop.getSlot("egg").unlocked, true);
  assert.equal(tank.shop.getSlot("egg").price, 0);
  const startingBalance = tank.state.money;
  for (let i = 1; i < PET_TYPES.length; i++) {
    assert.equal(tank.buy("egg"), "bought");
    assert.equal(tank.state.pets.length, i + 1);
  }
  assert.equal(tank.state.money, startingBalance);
  assert.equal(tank.state.status, "playing");
  assert.equal(tank.shop.eggPieces, 0);
  const roster = tank.state.pets.map((pet) => pet.morph ? "presto" : pet.type);
  assert.deepEqual(roster.sort(), [...PET_TYPES].sort());
  assert.equal(tank.shop.getSlot("egg").maxed, true);
  assert.equal(tank.buy("egg"), "maxed");
  tank.state.pets.pop();
  assert.equal(tank.shop.getSlot("egg").maxed, false);
  assert.equal(tank.buy("egg"), "bought");
  assert.equal(tank.state.pets.length, PET_TYPES.length);
});

test("Time Trial ends at the selected tank's deadline and freezes the final balance", () => {
  for (const [tankNumber, duration] of [[1, 300], [2, 600], [3, 600], [4, 600]]) {
    const tank = new Tank(random, { mode: "time-trial", tank: tankNumber });
    assert.equal(tank.trialSecondsLeft, duration);
    const deadline = Math.ceil(duration * 1000 / TICK_MS);
    tank.state.tick = deadline - 2;
    tank.step();
    assert.equal(tank.trialSecondsLeft, 1);
    assert.equal(tank.state.status, "playing");
    tank.step();
    assert.equal(tank.trialSecondsLeft, 0);
    assert.equal(tank.state.status, "complete");
    assert.equal(tank.click(300, 60), null);
    tank.step();
    assert.equal(tank.state.tick, deadline);
    assert.equal(tank.state.money, 200);
  }
});

test("Time Trial eggs unlock from breeders and hatch different pets at increasing prices", () => {
  const tank = new Tank(random, { mode: "time-trial", tank: 4 });
  assert.equal(tank.buy("egg"), "locked");
  tank.shop.onGrow("breeder", 2);
  tank.state.money = 300;
  assert.equal(tank.buy("egg"), "bought");
  assert.equal(tank.state.money, 200);
  assert.equal(tank.buy("egg"), "bought");
  assert.equal(tank.state.money, 0);
  assert.equal(tank.shop.getSlot("egg").price, 400);
  assert.equal(new Set(tank.state.pets.map((pet) => pet.type)).size, 5);
  assert.equal(tank.shop.eggPieces, 0);
  assert.equal(tank.state.status, "playing");
});

test("Challenge egg pieces reset other prices, pause inflation, and complete the tank on the third purchase", () => {
  const tank = new Tank(random, { mode: "challenge" });
  tank.shop.reveal("guppy", "egg");
  tank.state.money = 20000;
  tank.state.tick = 149;
  tank.step();
  assert.equal(tank.shop.getSlot("guppy").price, 101);
  assert.equal(tank.shop.getSlot("egg").price, 5050);
  assert.equal(tank.buy("egg"), "bought");
  assert.equal(tank.state.money, 14950);
  assert.equal(tank.shop.getSlot("guppy").price, 100);
  assert.equal(tank.shop.getSlot("egg").price, 5050);
  tank.state.tick = 599;
  tank.step();
  assert.equal(tank.shop.getSlot("guppy").price, 100);
  tank.state.tick = 749;
  tank.step();
  assert.equal(tank.shop.getSlot("guppy").price, 101);
  assert.equal(tank.buy("egg"), "bought");
  assert.equal(tank.state.status, "playing");
  assert.equal(tank.buy("egg"), "bought");
  assert.equal(tank.shop.eggPieces, 3);
  assert.equal(tank.state.status, "complete");
});

test("Challenge increases Tank 1's alien wave size after four attacks", () => {
  const tank = new Tank(() => 0.9, { mode: "challenge" });
  const enemiesPerWave = [];
  for (let step = 0; step < 15100 && enemiesPerWave.length < 5; step++) {
    for (const fish of tank.state.fish) fish.fullness = 450;
    tank.step();
    if (tank.alienSystem.wavesStarted <= enemiesPerWave.length) continue;
    const aliens = [...tank.alienSystem.aliens];
    enemiesPerWave.push(aliens.length);
    for (const alien of aliens) tank.alienSystem.damage(alien, alien.health);
  }
  assert.deepEqual(enemiesPerWave, [1, 1, 1, 1, 2]);
});
