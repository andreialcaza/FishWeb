# Insane Aquarium Web

The TypeScript browser port includes Adventure, Time Trial, Challenge, Virtual Tank, and Sandbox. The C++ desktop project is under `source/`.

## Run locally

With Node.js 20 or later, run these commands from the repository root:

```sh
npm ci
npm start
```

`npm start` builds the game and starts the local server. Open `http://127.0.0.1:4173/` and leave the terminal running while you play. In Windows PowerShell, use `npm.cmd ci` and `npm.cmd start` if script execution is disabled. Use `npm run check` for a type check or `npm run build` to generate the static site in `dist/` for another HTTP server.

Choose **Start Adventure** and pick any of Tanks 1–4. Each tank button shows its current level, such as **Tank 2-1**. Choose up to three unlocked pets or start with an empty lineup. Click or tap the tank to drop food, collect coins, and shoot aliens. Feed Gus pellets during its attacks. Grow fish to unlock shop slots and buy three egg pieces to advance. Earn each pet by clearing its level, and clear all four tanks to unlock the Cyrax battle in Tank 5.

Adventure saves each tank’s progress and pet lineup in the browser, including on static hosting. After reloading or reopening the site, choose **Continue Adventure** and pick a tank to start at its current level. You can replay the last level of a completed tank. Saves are tied to the same browser profile and site address, including its protocol and port.

**Time Trial** and **Challenge** are available immediately with Tank 1. Each additional tank in these modes unlocks after you clear the preceding tank in Adventure. Time Trial gives you five minutes in Tank 1 or ten minutes in Tanks 2–4 to finish with the highest balance. The egg slot hatches random pets and doubles in price after each purchase. In Challenge, buy three egg pieces while shop prices rise and alien waves grow. Each piece resets the other shop prices. Tank unlocks and personal bests are saved in your browser.

Select **More** to reveal **Sandbox**. Select **More** again to return to the original game modes. In Sandbox, click the shop egg to hatch a random pet for free. Open **Menu** and **Sandbox Controls** to choose a specific pet, change tank layouts, spawn fish and aliens, or select exotic food. The sandbox includes all 10 fish types, 24 pets, and 10 alien types.

Open **Menu** to pause and choose **OK** to resume. While the page is open, reselect a tank with a run in progress to choose **Continue** or **Restart**. In Adventure, make that choice on the pet screen. Use **Continue** with your saved lineup or **Restart Level** to start over with the selected pets. To play with the keyboard, focus the tank, aim with the arrow keys, and press Space. Run `npm test` to check shop purchases, Adventure saving, the sandbox roster, and the final battle.

Open **Hall of Fame** for the fastest Adventure level times, the five highest Time Trial balances and five fastest Challenge times per tank, and your personal bests. After defeating Cyrax, Adventure also shows how many pets survived. Records are saved in the current browser, and any existing Time Trial or Challenge bests appear automatically.

Open **Virtual Tank** from the main menu to start with 200 shells and an empty aquarium. Visit the **Store** to buy and name fish. Stock changes with the local date. Feed your fish with free pellets or use **Feed** for special diets. Fish grow with regular care and stay alive if they miss meals. Collect shells in Virtual Tank or earn them through Time Trial, Challenge, and Adventure rewards.

Use **Fish** to see care details, show or hide fish, rename them, or sell them. Use **Pets** to add unlocked pets and **Tank** to change backdrops and configure equipment. Your aquarium and shell balance are saved in your browser. **Tank** also offers a fullscreen Screensaver view.

**Options** offers fullscreen where the browser supports it. Music starts after your first interaction. Set **Music** or **Sound effects** to zero to mute that channel. Both volume sliders are available in the main menu and tank options.

Play the original fish songs from **Sandbox Controls**. The web build copies MP3 music and WAV effects into `dist/` and converts the scores in `fishsongs/` to note data for playback.

Portrait orientation is unsupported. In fullscreen, Insane Aquarium Web requests a landscape orientation lock from the browser.

## Change the tank art

The game uses the aquarium and sprite sheets in `images/`. Edit `web/art/manifest.json` to choose different images. Reference files in `images/` with `../images/`, or add browser-readable images to `web/art/` and reference them by filename. The optional keys are `background`, `fish`, `food`, and `coin`. A single image uses a filename, and an animated sprite sheet uses an object:

```json
{
  "background": "tank.jpg",
  "fish": {
    "src": "fish.png",
    "columns": 4,
    "rows": 2,
    "row": 0,
    "firstColumn": 0,
    "frameCount": 4,
    "fps": 8,
    "faces": "right"
  },
  "food": "pellet.png",
  "coin": "coin.gif"
}
```

Sprite sheet cells must be equally sized. Row and column indexes start at zero. Set `fps` to `0` to display a single frame. Use transparent images for fish, food, and coins, or add an `alpha` filename to the sprite object for a grayscale mask with the same dimensions as `src`. Black pixels are transparent and white pixels preserve the source opacity. The game draws its own art when a file is missing or a manifest entry is invalid. Run `npm start` after editing to rebuild with the new files.

Use `variantRows` to choose a row by fish growth stage (0, 1, or 2) or coin value (15 or 35). Other values use the default `row`. Use `drawSize` to set the displayed frame width for fish or the maximum frame dimension for food and coins, including any transparent padding.
