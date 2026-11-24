import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const compiler = fileURLToPath(new URL('node_modules/typescript/bin/tsc', root));
const result = spawnSync(process.execPath, [...process.execArgv, compiler, '--project', 'tsconfig.json'], {
  cwd: fileURLToPath(root),
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const dist = new URL('dist/', root);
await mkdir(dist, { recursive: true });
await Promise.all(['index.html', 'style.css'].map((file) =>
  copyFile(new URL(`web/${file}`, root), new URL(file, dist)),
));

async function copyAssets(source, destination) {
  const entries = await readdir(source, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  await mkdir(destination, { recursive: true });
  await Promise.all(entries.map((entry) => {
    const input = join(source, entry.name);
    const output = join(destination, entry.name);
    if (entry.isDirectory()) return copyAssets(input, output);
    if (entry.isFile()) return copyFile(input, output);
  }));
}

function browserWave(wave, file) {
  const formatEnd = 36;
  if (wave.toString('ascii', formatEnd, formatEnd + 4) !== 'dep ' ||
      wave.readUInt32LE(4) === wave.length - 8) return wave;

  // Desktop caches omit metadata from the RIFF size and write chunks without padding.
  let dataChunk = formatEnd + 8 + wave.readUInt32LE(formatEnd + 4);
  let xor = 0;
  if (wave.toString('ascii', dataChunk, dataChunk + 4) === 'xor ' &&
      wave.readUInt32LE(dataChunk + 4) === 1) {
    xor = wave[dataChunk + 8];
    dataChunk += 9;
  }
  const samplesStart = dataChunk + 8;
  if (wave.toString('ascii', 0, 4) !== 'RIFF' ||
      wave.toString('ascii', 8, 16) !== 'WAVEfmt ' || wave.readUInt32LE(16) !== 16 ||
      samplesStart > wave.length || wave.toString('ascii', dataChunk, dataChunk + 4) !== 'data' ||
      wave.readUInt32LE(dataChunk + 4) !== wave.length - samplesStart) {
    throw new Error(`Invalid desktop WAV cache: ${file}`);
  }

  const dataSize = wave.length - samplesStart;
  const output = Buffer.concat(
    [wave.subarray(0, formatEnd), wave.subarray(dataChunk)],
    formatEnd + 8 + dataSize + dataSize % 2,
  );
  output.writeUInt32LE(output.length - 8, 4);
  if (xor) {
    for (let index = formatEnd + 8; index < formatEnd + 8 + dataSize; index++) output[index] ^= xor;
  }
  return output;
}

async function buildSounds() {
  const { SOUND_FILES } = await import(new URL('src/audio.js', dist));
  const source = new URL('sounds/web/', root);
  const destination = new URL('sounds/', dist);
  await mkdir(destination, { recursive: true });
  await Promise.all(SOUND_FILES.map(async (name) => {
    const file = `${name}.wav`;
    const wave = await readFile(new URL(file, source));
    await writeFile(new URL(file, destination), browserWave(wave, file));
  }));
}

async function buildFishSongs() {
  const { parseFishSong } = await import(new URL('src/fish-song.js', dist));
  const source = new URL('fishsongs/', root);
  const destination = new URL('fishsongs/', dist);
  await mkdir(destination, { recursive: true });
  const files = (await readdir(source)).filter((file) => /^[\w-]+\.txt$/i.test(file));
  const catalog = await Promise.all(files.map(async (file) => {
    const id = file.slice(0, -4);
    const text = await readFile(new URL(file, source), 'utf8');
    let song;
    try {
      song = parseFishSong(text);
    } catch (error) {
      throw new Error(`Could not parse fishsongs/${file}`, { cause: error });
    }
    await writeFile(new URL(`${id}.json`, destination), JSON.stringify(song));
    return { id, title: song.title || id, long: /_long$/i.test(id) };
  }));
  catalog.sort((a, b) => a.title.localeCompare(b.title) || Number(a.long) - Number(b.long));
  await writeFile(new URL('catalog.json', destination), JSON.stringify(catalog));
}

await Promise.all([
  copyAssets(fileURLToPath(new URL('web/art/', root)), fileURLToPath(new URL('art/', dist))),
  copyAssets(fileURLToPath(new URL('images/', root)), fileURLToPath(new URL('images/', dist))),
  copyAssets(fileURLToPath(new URL('music/web/', root)), fileURLToPath(new URL('music/', dist))),
  buildSounds(),
  buildFishSongs(),
]);
