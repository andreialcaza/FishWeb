import { drawTankSprite } from "./art.js";
import { createFish } from "./fish.js";
import { drawFishLayer } from "./fish-art.js";
import { createPorthole, sidePortholePositions } from "./porthole.js";
import { ATTRACTOR_POSITIONS, SANDBOX_FISH } from "./simulation.js";
import { TANK_ART_OFFSET_X } from "./tank-geometry.js";
import { BACKDROP_NAMES, fishMood, requiredFood, resaleValue, SPECIAL_FOOD, virtualDay } from "./virtual-tank.js";
const format = new Intl.NumberFormat();
const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const itemNames = { bubbulator: "Bubbulator", attractor: "Alien Attractor", upgrade: "Food Upgrade" };
const traitNames = {
    invisible: "Invisible", voracious: "Voracious eater", speedy: "Speedy", singing: "Musical genius", backward: "Swims backward",
};
const hometowns = ["Reading, Pa.", "Lima, Ohio", "Saskatoon, Sask.", "Oakland, Calif.", "Salem, Ore.", "Phoenix, Ariz.",
    "Madison, Wis.", "Atlanta, Ga.", "Duluth, Minn.", "Austin, Tex.", "Portland, Maine", "Boise, Idaho"];
const specialHometowns = { Rocky: "Philadelphia, Pa.", Ludwig: "Vienna, Austria", Cookie: "Biloxi, Miss.",
    "Johnny V.": "Rensselaer, Ind.", Kilgore: "Los Angeles, Calif.", Santa: "North Pole" };
const likes = ["tropical vacations", "ice skating", "puzzles", "singing", "picnics", "comedy", "jazz", "gardening",
    "cloud watching", "collecting shells", "hiking", "board games", "crosswords"];
const bubblePositions = [[470, 300], [550, 315], [550, 315], [10, 325], [540, 315], [360, 315]];
const storeShelves = [
    [1, 5, 109, 140, "left"], [1, 143, 109, 140, "left"], [1, 282, 109, 140, "left"],
    [193, 38, 98, 140, "top"], [303, 38, 98, 140, "top"], [414, 38, 98, 140, "top"], [525, 38, 98, 140, "top"],
    [489, 339, 121, 100, "right"],
];
const storeFishPositions = {
    guppy: [[59, 60], [50, 57], [59, 40]],
    oscar: [[57, 57], [47, 57], [57, 40]],
    breeder: [[58, 60], [47, 60], [55, 40]],
    ultra: [[93, 58], [83, 58], [83, 38]],
    gekko: [[63, 60], [55, 57], [60, 40]],
    penta: [[60, 57], [45, 57], [55, 35]],
    grubber: [[59, 57], [45, 53], [55, 35]],
    bi: [[55, 60], [45, 55], [55, 45]],
    ball: [[60, 60], [45, 55], [55, 35]],
    sylvester: [[60, 57], [55, 57], [58, 40]],
};
const storePurchaseCopy = {
    background: "Would you like to buy this backdrop?",
    bubbulator: "Would you like to buy The Bubbulator?",
    attractor: "Would you like to buy the Alien Attractor?",
    upgrade: "Would you like to upgrade your fish food?",
};
function storeDescription({ item, sold }) {
    if (sold)
        return "Sorry, this is sold out.\nCheck back tomorrow!";
    if (item.type !== "fish")
        return {
            background: "Keep your fish happy\nwith this beautiful\nnew backdrop!",
            bubbulator: "Want to keep more fish\nin your tank? Buy\nThe Bubbulator!",
            attractor: "Need more excitement\nin your tank? Buy\nthe Alien Attractor!\nTrust me. It's safe!",
            upgrade: "Your fish will\ngrow faster with\nthis food upgrade!",
        }[item.type];
    const { spec } = item;
    if (spec.name === "Cookie")
        return "This is Cookie.\nCookie will feed\nyour more exotic fish.";
    if (spec.name)
        return `This is ${spec.name.endsWith(".") ? spec.name : spec.name + "."}`;
    const traits = spec.traits ?? [];
    if (traits.length + Number(Boolean(spec.diet)) > 1)
        return "This fish is extremely\nrare. We hardly ever\nget them in stock.";
    if (traits.length)
        return {
            invisible: "You've never seen\na fish like this!",
            voracious: "This fish is a\nvoracious eater.",
            speedy: "This fish goes\nfrom 0 to 60\nin 1.3 seconds!",
            singing: "This fish is\na musical genius!",
            backward: "This fish swims\nbackward!",
        }[traits[0]];
    if (spec.diet)
        return spec.diet >= 1000 ? "This fish has a\nvery special diet." : "This fish has\ndeveloped a taste\nfor exotic food!";
    if (spec.hue === "rainbow")
        return "This one's pretty\ncool, isn't it?";
    if (spec.kind === "guppy" && spec.hue !== undefined)
        return "Choose from a dazzling\narray of colors!";
    return {
        guppy: "These adorable little\nfish are a mainstay\nof any aquarium!",
        oscar: "These carnivores leave\nyour store-bought\nguppies alone!",
        breeder: "Take care of this fish,\nand she'll give you a\nbaby fish at\nno extra charge!",
        ultra: "Many regard this\nto be the\nSUV of fish!",
        gekko: "All of our fish come\nwith a free plastic bag!\nTake one home today!",
        penta: "Isn't this little guy\njust the cutest?\nAnswer: Yes.",
        grubber: "Watch your fingers\naround this one!",
        sylvester: "Don't worry. This\n“fish” has been\ndomesticated.",
        ball: "Some people think\nthis fish looks\nlike a ball.",
        bi: "This “fish” may look\ndead, but he is actually\nquite lively!",
    }[spec.kind];
}
function element(id) {
    return document.getElementById(id);
}
function button(label, action) {
    const entry = document.createElement("button");
    entry.type = "button";
    entry.textContent = label;
    entry.addEventListener("click", action);
    return entry;
}
function text(tag, label) {
    const node = document.createElement(tag);
    node.textContent = label;
    return node;
}
function image(file) {
    const node = document.createElement("img");
    node.src = "./images/" + file;
    node.alt = "";
    return node;
}
function shells(amount) {
    return `${format.format(amount)} ${amount === 1 ? "shell" : "shells"}`;
}
function productName(item) {
    if (item.type === "background")
        return BACKDROP_NAMES[item.background - 1];
    if (item.type !== "fish")
        return itemNames[item.type];
    const { spec } = item;
    const color = spec.hue === "rainbow" ? "Rainbow " : spec.hue === undefined ? "" : "Colorful ";
    return spec.name ?? color + SANDBOX_FISH[spec.kind];
}
export function drawVirtualFish(ctx, art, fish, record, seconds, showNames = false) {
    const { spec } = record;
    const invisible = spec.traits?.includes("invisible") && !fish.hungry;
    ctx.save();
    if (invisible)
        ctx.globalAlpha *= fish.animation === "eat" ? 0.7 : 0.08 + 0.13 * Math.abs(Math.sin(seconds));
    if (spec.hue !== undefined)
        ctx.filter = `hue-rotate(${spec.hue === "rainbow" ? seconds * 110 % 360 : spec.hue}deg)`;
    drawFishLayer(ctx, art, spec.traits?.includes("backward") ? { ...fish, direction: fish.direction === 1 ? -1 : 1 } : fish, seconds);
    ctx.restore();
    if (showNames && record.name && !fish.hidden) {
        ctx.save();
        ctx.font = "bold 13px Trebuchet MS, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#142638";
        ctx.fillStyle = fish.hungry ? "#fff075" : "#fff";
        const y = Math.min(380, fish.y + (fish.size >= 160 ? 48 : 31));
        ctx.strokeText(record.name, fish.x, y);
        ctx.fillText(record.name, fish.x, y);
        ctx.restore();
    }
}
export function drawVirtualDecorations(ctx, tank, seconds) {
    const settings = tank.virtualTank?.settings;
    if (!settings)
        return;
    if (settings.showBubbulator) {
        const [originalX, y] = bubblePositions[tank.background - 1];
        const x = originalX + TANK_ART_OFFSET_X;
        const frame = Math.floor(seconds * 36) % 240;
        drawTankSprite(ctx, "bubbulator.jpg", "bubbulator_.gif", 1, 20, 0, frame < 60 ? frame % 20 : 0, x + 34, y + 9);
        ctx.save();
        ctx.strokeStyle = "#d1fbff9c";
        for (let i = 0; i < 9; i++) {
            const phase = (seconds * (28 + i) + 23 * i) % 310;
            ctx.beginPath();
            ctx.arc(x + 33 + 16 * Math.sin(seconds + i), y - 11 - phase, 2 + i % 4, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
    if (settings.showAttractor) {
        const [x, y] = ATTRACTOR_POSITIONS[tank.background - 1];
        if (tank.alienSystem.warning && tank.alienSystem.warning.ticks < 30) {
            drawTankSprite(ctx, "aabeam.jpg", "aabeam_.jpg", 1, 1, 0, 0, x + 40, y - 138, 92);
        }
        drawTankSprite(ctx, "aabottom.jpg", "aabottom_.gif", 1, 1, 0, 0, x + 40, y - 4);
        const phase = Math.floor(seconds * 5) % 2 + 1;
        drawTankSprite(ctx, `aatop${phase}.jpg`, "aatop_.jpg", 1, 1, 0, 0, x + 40, y - 24);
    }
}
export function setupVirtualControls(save, art, getTank, unlockedPets, changed, requestScreensaver, playBuy) {
    const panel = element("virtual-panel");
    const prompt = element("virtual-prompt");
    const content = element("virtual-content");
    const title = element("virtual-title");
    const form = element("virtual-prompt-form");
    const nameField = element("virtual-name-field");
    const nameInput = element("virtual-name");
    const cancel = element("virtual-cancel");
    const confirm = element("virtual-confirm");
    const promptSettings = element("virtual-prompt-settings");
    const controls = element("virtual-controls");
    const feed = controls.querySelector('[data-virtual-view="feed"]');
    const foodPicker = element("virtual-food-picker");
    const foodButtons = new Map();
    const store = element("virtual-store");
    const stock = element("virtual-store-stock");
    const storeArt = element("virtual-store-art").getContext("2d");
    const storeBalance = element("virtual-store-shells");
    const storeSpeech = element("virtual-store-speech");
    const storeBack = element("virtual-store-back");
    const storeControl = controls.querySelector('[data-virtual-view="store"]');
    const fishScreen = element("virtual-fish-screen");
    const fishTitle = element("virtual-fish-title");
    const fishRoster = element("virtual-fish-roster");
    const fishPreview = element("virtual-fish-preview");
    const fishActions = element("virtual-fish-actions");
    const fishBack = element("virtual-fish-back");
    const showAll = element("virtual-fish-show-all");
    const hideAll = element("virtual-fish-hide-all");
    const fishControl = controls.querySelector('[data-virtual-view="fish"]');
    const tankControl = controls.querySelector('[data-virtual-view="tank"]');
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const previews = [];
    let shelves = [];
    let selectedShelf;
    let hoveredShelf;
    let speechDue = 0;
    let thanksUntil = 0;
    let selected;
    let afterConfirm;
    let frame;
    let stockDay = 0;
    let checkedDate = 0;
    function ask(heading, message, action, label = "OK", name) {
        element("virtual-prompt-title").textContent = heading;
        element("virtual-prompt-message").textContent = message;
        afterConfirm = action;
        confirm.textContent = label;
        cancel.hidden = !action;
        nameField.hidden = name === undefined;
        nameInput.required = name !== undefined;
        nameInput.value = name ?? "";
        promptSettings.replaceChildren();
        prompt.toggleAttribute("data-store-prompt", !store.hidden);
        prompt.showModal();
        changed();
        if (name !== undefined) {
            nameInput.focus();
            nameInput.select();
        }
        else
            (action ? cancel : confirm).focus();
    }
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const action = afterConfirm;
        const name = nameInput.value.trim();
        if (nameInput.required && !name) {
            nameInput.value = "";
            nameInput.reportValidity();
            return;
        }
        prompt.close();
        action?.(name);
        changed();
    });
    cancel.addEventListener("click", () => prompt.close());
    prompt.addEventListener("close", () => {
        if (!prompt.open && selectedShelf) {
            delete selectedShelf.dataset.selected;
            selectedShelf = undefined;
        }
        changed();
    });
    function addFishPreview(surface, { spec, stage }) {
        const canvas = surface.getContext("2d");
        if (!canvas)
            return;
        const fish = createFish(spec.kind, surface.width / 2, surface.height / 2, -1, () => 0.5, { stage });
        previews.push({ canvas, fish, spec });
    }
    function drawFishPreviews(timestamp) {
        const time = reducedMotion.matches ? 0 : timestamp;
        const frame = Math.floor(time / 100) % 10;
        for (const { canvas, fish, spec } of previews) {
            const { width, height } = canvas.canvas;
            const scale = Math.min(1, (width - 8) / fish.size, height / 80);
            canvas.clearRect(0, 0, width, height);
            canvas.save();
            canvas.translate(fish.x * (1 - scale), fish.y * (1 - scale));
            canvas.scale(scale, scale);
            drawVirtualFish(canvas, art, { ...fish, frame }, { spec, name: "" }, time / 1000);
            canvas.restore();
        }
    }
    function animate(timestamp) {
        frame = undefined;
        if (store.hidden && fishScreen.hidden)
            return;
        if (!store.hidden && timestamp - checkedDate >= 1000) {
            checkedDate = timestamp;
            if (!prompt.open && stockDay !== virtualDay(save.now()))
                renderStore(true);
        }
        if (!store.hidden)
            drawStore(timestamp);
        if (!fishScreen.hidden)
            drawFishPreviews(timestamp);
        frame = requestAnimationFrame(animate);
    }
    function setStoreSpeech(message) {
        if (storeSpeech.textContent !== message)
            storeSpeech.textContent = message;
        storeSpeech.hidden = !message;
    }
    function drawStore(timestamp) {
        const speech = timestamp < thanksUntil ? "Thanks for shopping at\nthe Fish Emporium!"
            : hoveredShelf && timestamp >= speechDue ? storeDescription(hoveredShelf) : "";
        setStoreSpeech(speech);
        if (!storeArt)
            return;
        storeArt.clearRect(0, 0, 640, 480);
        const seconds = timestamp / 1000;
        const fishFrame = Math.floor(timestamp / 56) % 10;
        for (const { slot, fish, card } of shelves) {
            if (slot.sold)
                continue;
            const { item } = slot;
            const [x, y] = storeShelves[slot.id];
            if (item.type === "fish" && fish) {
                drawVirtualFish(storeArt, art, { ...fish, frame: fishFrame }, { spec: item.spec, name: "" }, seconds);
            }
            else if (item.type === "background") {
                drawTankSprite(storeArt, "StoreAquariums.jpg", undefined, 6, 1, item.background - 1, 0, x + 60.5, y + 35.5);
                if (card.matches(":hover, :focus-visible, [data-selected=true]")) {
                    storeArt.fillStyle = "#fff3";
                    storeArt.fillRect(x, y, 121, 71);
                }
            }
            else if (item.type === "bubbulator") {
                drawTankSprite(storeArt, "bubbulatorstore.gif", "bubbulatorstore_.gif", 1, 1, 0, 0, x + 56.5, y + 56.5);
            }
            else if (item.type === "attractor") {
                drawTankSprite(storeArt, "aastore.gif", "aastore_.gif", 1, 1, 0, 0, x + 59, y + 54);
            }
            else if (item.type === "upgrade") {
                drawTankSprite(storeArt, "food.gif", "_food.gif", 10, 5, Math.floor(timestamp / 112) % 10, 2, x + 60, y + 60);
            }
        }
    }
    function updateStoreShelf(shelf) {
        const { slot, card, price } = shelf;
        const name = productName(slot.item);
        if (slot.sold) {
            card.setAttribute("aria-disabled", "true");
            card.setAttribute("aria-label", `${name}. Sold out. Check back tomorrow.`);
            price.textContent = "SOLD";
        }
        else {
            card.setAttribute("aria-label", `${name}, ${shells(slot.item.price)}`);
            price.textContent = String(slot.item.price);
        }
    }
    function renderStore(restoreFocus = false, newVisit = false) {
        const activeSlot = shelves.find(({ card }) => card === document.activeElement)?.slot.id;
        hoveredShelf = undefined;
        setStoreSpeech("");
        const catalog = save.catalog(newVisit);
        stockDay = catalog[0].day;
        storeBalance.textContent = String(save.shells);
        shelves = catalog.map((slot) => {
            const { item } = slot;
            const [x, y, width, height, side] = storeShelves[slot.id];
            const card = button("", () => {
                if (slot.sold)
                    return;
                save.refresh();
                const problem = save.purchaseProblem(slot);
                if (problem) {
                    ask(problem.title, problem.message);
                    if (problem.title === "New Stock" || problem.title === "Sold Out")
                        renderStore(true);
                    return;
                }
                selectedShelf = card;
                card.dataset.selected = "true";
                setStoreSpeech("");
                ask(item.type === "fish" ? "Name Your Fish" : "Confirm Purchase", item.type === "fish" ? "Please choose a name for your fish." : storePurchaseCopy[item.type], (enteredName) => {
                    const error = save.purchase(slot, enteredName);
                    if (error) {
                        renderStore(true);
                        ask("Purchase Unavailable", error);
                        return;
                    }
                    slot.sold = true;
                    hoveredShelf = undefined;
                    thanksUntil = performance.now() + 3000;
                    storeBalance.textContent = String(save.shells);
                    updateStoreShelf(shelf);
                    playBuy();
                }, item.type === "fish" ? "OK" : "Buy", item.type === "fish" ? item.spec.name ?? "" : undefined);
                if (item.type === "fish") {
                    promptSettings.append(text("p", "All fish come with a one-day money-back guarantee."));
                }
            });
            card.className = "virtual-product";
            card.dataset.shelf = side;
            for (const [property, value] of [["x", x], ["y", y], ["width", width], ["height", height]]) {
                card.style.setProperty(`--slot-${property}`, String(value));
            }
            const price = text("span", "");
            price.className = "virtual-product-price";
            card.append(price);
            card.addEventListener("pointerenter", () => {
                hoveredShelf = slot;
                speechDue = performance.now() + 420;
                thanksUntil = 0;
            });
            card.addEventListener("pointerleave", () => {
                if (hoveredShelf === slot && !card.matches(":focus-visible"))
                    hoveredShelf = undefined;
            });
            card.addEventListener("focus", () => {
                if (!card.matches(":focus-visible"))
                    return;
                hoveredShelf = slot;
                speechDue = 0;
            });
            card.addEventListener("blur", () => {
                if (hoveredShelf === slot && !card.matches(":hover"))
                    hoveredShelf = undefined;
            });
            let fish;
            if (item.type === "fish") {
                const [offsetX, offsetY] = storeFishPositions[item.spec.kind][side === "left" ? 0 : side === "top" ? 1 : 2];
                fish = createFish(item.spec.kind, x + offsetX, y + offsetY, -1, () => 0.5);
            }
            const shelf = { slot, fish, card, price };
            updateStoreShelf(shelf);
            return shelf;
        });
        stock.replaceChildren(...shelves.map(({ card }) => card));
        if (restoreFocus && activeSlot !== undefined)
            shelves[activeSlot]?.card.focus();
    }
    function openStore() {
        closeFeed();
        thanksUntil = 0;
        renderStore(false, true);
        store.hidden = false;
        element("virtual-store-title").focus();
        if (frame === undefined)
            frame = requestAnimationFrame(animate);
        changed();
    }
    function closePage() {
        const inFishSetup = !fishScreen.hidden;
        fishScreen.hidden = store.hidden = true;
        previews.length = 0;
        if (frame !== undefined) {
            cancelAnimationFrame(frame);
            frame = undefined;
        }
        changed();
        (inFishSetup && !fishControl.hidden ? fishControl : storeControl).focus();
    }
    function renderFish(focus) {
        previews.length = 0;
        save.updateDay();
        const roster = save.fish.slice().sort((a, b) => a.acquired - b.acquired);
        if (!roster.some(({ id }) => id === selected))
            selected = roster[0]?.id;
        fishRoster.replaceChildren(...sidePortholePositions.map((position, index) => {
            const { button, canvas } = createPorthole(position);
            const fish = roster[index];
            if (!fish) {
                button.disabled = true;
                button.setAttribute("aria-label", "Empty fish slot");
                return button;
            }
            const name = fish.name || SANDBOX_FISH[fish.spec.kind];
            button.title = name;
            button.setAttribute("aria-label", fish.shown ? name : `${name} (hidden)`);
            button.setAttribute("aria-pressed", String(fish.id === selected));
            button.addEventListener("click", () => {
                if (selected === fish.id)
                    return;
                selected = fish.id;
                renderFish("#virtual-fish-roster [aria-pressed=true]");
            });
            addFishPreview(canvas, fish);
            if (!fish.shown) {
                const badge = text("span", "Hidden");
                badge.className = "virtual-fish-hidden";
                badge.setAttribute("aria-hidden", "true");
                button.append(badge);
            }
            return button;
        }));
        renderFishDetails(roster.find(({ id }) => id === selected));
        showAll.hidden = !roster.some((fish) => !fish.shown);
        hideAll.hidden = !roster.some((fish) => fish.shown);
        if (focus)
            (fishScreen.querySelector(focus) ?? fishBack).focus();
        changed();
    }
    function renderFishDetails(fish) {
        fishActions.hidden = !fish;
        if (!fish) {
            const empty = text("p", "Visit the Store to buy a fish.");
            empty.className = "virtual-fish-empty";
            fishPreview.replaceChildren(empty);
            fishActions.replaceChildren();
            return;
        }
        const name = fish.name || SANDBOX_FISH[fish.spec.kind];
        const food = requiredFood(fish);
        const personality = fish.personality;
        const positive = [0, 4, 8].map((offset) => likes[(personality + offset) % likes.length]);
        const refund = resaleValue(fish, save.now());
        const notes = [`Likes ${positive[0]}, ${positive[1]}, and ${positive[2]}.`,
            ...(fish.spec.traits ?? []).map((trait) => traitNames[trait] + "."),
            ...(food === undefined ? [] : [`Eats ${SPECIAL_FOOD[food].toLowerCase()}.`])].join(" ");
        const fields = document.createElement("dl");
        fields.tabIndex = 0;
        fields.setAttribute("aria-label", "Fish details");
        for (const [label, value] of [
            [fish.born ? "Date of Birth" : "Purchase Date", date.format(fish.acquired)],
            ["Hometown", fish.spec.name ? specialHometowns[fish.spec.name] : fish.born ? "Virtual Tank" : hometowns[personality % hometowns.length]],
            ["Mental State", fishMood(fish)], ["Additional Notes", notes],
            ["Purchase Price", fish.born ? "N/A" : shells(fish.price)], ["Resale Value", shells(refund)],
        ]) {
            const field = document.createElement("div");
            field.append(text("dt", label), text("dd", value));
            fields.append(field);
        }
        const portrait = document.createElement("canvas");
        portrait.width = 160;
        portrait.height = 72;
        portrait.setAttribute("aria-hidden", "true");
        addFishPreview(portrait, fish);
        fishPreview.replaceChildren(text("h3", name), portrait, fields);
        const show = button(fish.shown ? "Hide" : "Show", () => {
            save.showFish(fish.id, !fish.shown);
            renderFish("#virtual-show-fish");
        });
        show.id = "virtual-show-fish";
        const rename = button("Rename", () => ask("Rename Fish", "Please choose a name for your fish.", (newName) => {
            save.renameFish(fish.id, newName);
            renderFish("#virtual-rename-fish");
        }, "Rename", fish.name));
        rename.id = "virtual-rename-fish";
        rename.setAttribute("aria-haspopup", "dialog");
        const hasChildren = save.fish.some((entry) => entry.parent === fish.id);
        const sell = button("Sell", () => ask("Sell Fish", `Sell ${name} for ${shells(refund)}?${hasChildren ? " Her baby fish will stay in the tank." : ""}`, () => {
            save.sellFish(fish.id);
            renderFish("#virtual-fish-roster [aria-pressed=true]");
        }, "Sell"));
        sell.id = "virtual-sell-fish";
        sell.setAttribute("aria-haspopup", "dialog");
        for (const action of [show, rename, sell])
            action.className = "selection-action";
        fishActions.replaceChildren(show, rename, sell);
    }
    function openFish() {
        closeFeed();
        save.refresh();
        fishScreen.hidden = false;
        renderFish();
        fishTitle.focus();
        if (frame === undefined)
            frame = requestAnimationFrame(animate);
    }
    function confirmBonus(finish) {
        save.refresh();
        const { nextBonus, bonusPrice } = save;
        if (!bonusPrice)
            return;
        if (save.shells < bonusPrice) {
            ask("Not Enough Shells", "Keep playing to earn more shells.");
            return;
        }
        ask("Confirm Purchase", `Buy ${nextBonus} for ${shells(bonusPrice)}?`, () => {
            if (save.buyBonus(bonusPrice))
                playBuy();
            else
                ask("Purchase Unavailable", "The bonus offer or your shell balance changed.");
            finish();
        }, "Buy");
    }
    function closeFeed(restoreFocus = false) {
        if (foodPicker.hidden)
            return;
        foodPicker.hidden = true;
        feed.setAttribute("aria-expanded", "false");
        if (restoreFocus)
            feed.focus();
    }
    function openFeed() {
        if (!foodPicker.hidden) {
            closeFeed();
            return;
        }
        const tank = getTank();
        if (!tank)
            return;
        const foods = tank.specialFoods();
        const needed = tank.specialFoodNeeded();
        if (!needed.length)
            return;
        if (foods.length === 1) {
            tank.feedSpecial(needed[0]);
            changed();
            return;
        }
        foodButtons.clear();
        for (const food of foods) {
            const choice = button(SPECIAL_FOOD[food], () => {
                tank.feedSpecial(food);
                changed();
            });
            choice.disabled = !needed.includes(food);
            foodButtons.set(food, choice);
        }
        foodPicker.replaceChildren(...foodButtons.values(), button("Close", () => closeFeed(true)));
        foodPicker.hidden = false;
        feed.setAttribute("aria-expanded", "true");
        foodPicker.querySelector("button:enabled")?.focus();
    }
    function renderTank() {
        content.replaceChildren();
        const layout = document.createElement("div");
        layout.className = "virtual-tank-layout";
        const backdrop = document.createElement("div");
        backdrop.className = "virtual-backdrop";
        backdrop.append(image(`tankbackdrop${save.background}.gif`), text("h3", BACKDROP_NAMES[save.background - 1]));
        const actions = document.createElement("div");
        actions.className = "virtual-actions";
        const previous = button("Prev", () => { save.cycleBackground(-1); refreshTank("#virtual-prev-backdrop"); });
        previous.id = "virtual-prev-backdrop";
        const next = button("Next", () => { save.cycleBackground(1); refreshTank("#virtual-next-backdrop"); });
        next.id = "virtual-next-backdrop";
        previous.disabled = next.disabled = save.backgrounds.length < 2;
        const sell = button("Sell", () => {
            const current = save.background;
            if (save.backgrounds.length === 1)
                ask("Not Allowed", "You are not allowed to sell your only backdrop!");
            else
                ask("Sell Backdrop", `Sell ${BACKDROP_NAMES[current - 1]} for 10,000 shells?`, () => {
                    save.sellBackground(current);
                    refreshTank();
                }, "Sell");
        });
        actions.append(previous, sell, next);
        backdrop.append(actions, button("Screensaver…", () => {
            const settings = [
                ["screensaverSound", "Enable sound"], ["screensaverRotate", "Rotate backdrops"],
                ["screensaverDim", "Periodically darken screen"], ["screensaverShells", "Show shells collected"],
            ];
            const options = settings.map(([key, label]) => {
                const row = document.createElement("label");
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = save.settings[key];
                row.append(checkbox, label);
                return { key, row, checkbox };
            });
            ask("Screensaver", "Watch your Virtual Tank fullscreen. Press Escape or choose Exit Screensaver to return.", () => {
                save.configure(Object.fromEntries(options.map(({ key, checkbox }) => [key, checkbox.checked])));
                void requestScreensaver().then((started) => {
                    if (started)
                        panel.close();
                    else
                        ask("Fullscreen Unavailable", "Fullscreen is unavailable in this browser view.");
                });
            }, "Start Screensaver");
            promptSettings.append(...options.map(({ row }) => row));
        }));
        const settings = document.createElement("div");
        settings.className = "virtual-settings";
        for (const [key, label, owned] of [
            ["showNames", "Display fish names", true], ["showBubbulator", "Show Bubbulator", save.hasBubbulator],
            ["showAttractor", "Show Alien Attractor", save.hasAttractor], ["dropShells", "Drop shells", true],
            ["showHungry", "Always show hungry fish", true],
        ]) {
            const row = document.createElement("label");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = save.settings[key];
            checkbox.addEventListener("change", () => {
                if (!owned && checkbox.checked) {
                    checkbox.checked = false;
                    ask("Unavailable", `Buy the ${key === "showBubbulator" ? "Bubbulator" : "Alien Attractor"} in the Store to use this option.`);
                }
                else {
                    save.configure({ [key]: checkbox.checked });
                    changed();
                }
            });
            row.append(checkbox, label);
            settings.append(row);
        }
        layout.append(backdrop, settings);
        content.append(layout);
    }
    function refreshTank(focus) {
        renderTank();
        if (focus)
            (content.querySelector(focus) ?? title).focus();
        changed();
    }
    function openTankSetup() {
        save.refresh();
        closeFeed();
        renderTank();
        panel.showModal();
        title.focus();
        changed();
    }
    element("virtual-close").addEventListener("click", () => panel.close());
    panel.addEventListener("close", changed);
    storeBack.addEventListener("click", closePage);
    fishBack.addEventListener("click", closePage);
    showAll.addEventListener("click", () => {
        save.showFish(undefined, true);
        renderFish("#virtual-fish-hide-all");
    });
    hideAll.addEventListener("click", () => {
        save.showFish(undefined, false);
        renderFish("#virtual-fish-show-all");
    });
    feed.addEventListener("click", openFeed);
    storeControl.addEventListener("click", openStore);
    fishControl.addEventListener("click", openFish);
    tankControl.addEventListener("click", openTankSetup);
    return {
        get open() { return panel.open || prompt.open || this.pageOpen; },
        get pageOpen() { return !store.hidden || !fishScreen.hidden; },
        closePage,
        get feedOpen() { return !foodPicker.hidden; },
        closeFeed,
        confirmBonus,
        updateButtons(tank) {
            for (const [view, visible] of [["fish", save.fish.length > 0], ["pets", unlockedPets().length > 0],
                ["feed", tank.specialFoods().length > 0]]) {
                controls.querySelector(`[data-virtual-view="${view}"]`).hidden = !visible;
            }
            if (!foodPicker.hidden) {
                const needed = tank.specialFoodNeeded();
                for (const [food, choice] of foodButtons)
                    choice.disabled = !needed.includes(food);
            }
        },
        welcome() {
            if (save.fish.length)
                return;
            ask("Welcome to Virtual Tank!", `Visit the Store to buy fish. You have ${shells(save.shells)} to spend, and you can earn more in the tank and other game modes. Virtual fish never die. Feed them regularly to help them grow.`);
        },
    };
}
