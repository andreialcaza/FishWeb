const variants = {
    chomp: ["chomp", "chomp", "chomp2"],
    points: ["points", "points2", "points3", "points4"],
    slurp: ["slurp", "slurp", "slurp", "slurp2", "slurp3"],
    splash: ["splash", "splash2", "splash3"],
};
const samples = [
    "applause", "awooga", "baby", "bigchomp", "bonuscollect", "bubbles", "buttonclick", "buy",
    "buzzer", "crowned1", "diamond", "die", "ding", "dinghi", "dinglo", "dingsuperhi", "dropfood",
    "eel1", "eel2", "eel3", "evillaff", "explode", "explosion1", "explosion4", "grow", "guffaw",
    "hatch", "heal", "hit", "interfer", "missle", "nikoclose", "nikoopen", "pearl", "punch",
    "rattle", "ricochet", "roar", "roar2", "roar3", "sfx", "sing", "sneeze", "sonar",
    "splashbig", "tapglass", "treasure", "unleash", "zap", "zzam",
];
export const SOUND_FILES = [...new Set([...samples, ...Object.values(variants).flat()])];
// Tracker sections start at the desktop's order and loop back to the order's rendered time.
const loopStarts = {
    menu: 0, "tank-1": 18.947, "tank-2": 7.681, "tank-3": 5.120, "tank-4": 0,
    warning: 0, battle: 18.721, cyrax: 17.281, complete: 5.080, lullaby: 2.601,
};
const root = new URL("../", import.meta.url);
const defaultVolumes = { music: 60, effects: 85 };
function readVolume(channel) {
    try {
        const saved = localStorage.getItem("winfish:volume:" + channel);
        if (saved !== null && /^\d{1,3}$/.test(saved) && Number(saved) <= 100)
            return Number(saved);
    }
    catch {
        // The controls still work in a browser view without storage.
    }
    return defaultVolumes[channel];
}
async function getAsset(path) {
    const response = await fetch(new URL(path, root));
    if (!response.ok)
        throw new Error(`Could not load ${path}`);
    return response;
}
export async function loadFishSongCatalog() {
    return (await getAsset("fishsongs/catalog.json")).json();
}
export class GameAudio {
    volumes = { music: readVolume("music"), effects: readVolume("effects") };
    context;
    musicGain;
    effectsGain;
    track = "menu";
    music;
    musicRequest = 0;
    song;
    songRequest = 0;
    musicBuffers = new Map();
    effects = new Map();
    lastEffect = new Map();
    unlock() {
        if (document.hidden)
            return;
        if (!this.context) {
            if (!window.AudioContext)
                return;
            try {
                const context = new AudioContext();
                this.context = context;
                this.musicGain = context.createGain();
                this.effectsGain = context.createGain();
                this.musicGain.connect(context.destination);
                this.effectsGain.connect(context.destination);
                this.musicGain.gain.value = this.volumes.music / 100;
                this.effectsGain.gain.value = this.volumes.effects / 100;
                if (this.volumes.effects)
                    this.preloadEffects();
                void this.startMusic();
            }
            catch {
                return;
            }
        }
        if (this.context.state !== "running")
            void this.context.resume().catch(() => { });
    }
    visibilityChanged() {
        if (!this.context)
            return;
        if (document.hidden)
            void this.context.suspend().catch(() => { });
        else
            this.unlock();
    }
    setVolume(channel, value) {
        const old = this.volumes[channel];
        this.volumes[channel] = value;
        try {
            localStorage.setItem("winfish:volume:" + channel, String(value));
        }
        catch {
            // An unavailable store only affects future visits.
        }
        if (!this.context)
            return;
        if (channel === "music") {
            this.updateMusicVolume();
            if (!old && !this.music)
                void this.startMusic();
        }
        else {
            this.effectsGain.gain.setTargetAtTime(value / 100, this.context.currentTime, 0.025);
            if (this.song)
                this.updateMusicVolume();
            if (!old && value)
                this.preloadEffects();
        }
    }
    setMusic(track) {
        if (track === this.track)
            return;
        this.track = track;
        this.musicRequest++;
        if (this.music) {
            const { source, gain } = this.music;
            const now = source.context.currentTime;
            gain.gain.cancelScheduledValues(now);
            gain.gain.setTargetAtTime(0, now, 0.055);
            source.stop(now + 0.25);
            this.music = undefined;
        }
        void this.startMusic();
    }
    async startMusic() {
        const { context, track } = this;
        if (!context || !track || !this.volumes.music)
            return;
        const request = ++this.musicRequest;
        try {
            let buffer = this.musicBuffers.get(track);
            if (!buffer)
                buffer = await context.decodeAudioData(await (await getAsset(`music/${track}.mp3`)).arrayBuffer());
            if (request !== this.musicRequest)
                return;
            this.musicBuffers.delete(track);
            this.musicBuffers.set(track, buffer);
            const oldest = this.musicBuffers.keys().next().value;
            if (oldest && this.musicBuffers.size > 3)
                this.musicBuffers.delete(oldest);
            const gain = context.createGain();
            gain.gain.value = 0;
            gain.gain.setTargetAtTime(1, context.currentTime, 0.07);
            gain.connect(this.musicGain);
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.loopStart = loopStarts[track];
            source.connect(gain);
            source.start();
            source.onended = () => gain.disconnect();
            this.music = { source, gain };
        }
        catch {
            // Missing or unsupported audio leaves the game playable.
        }
    }
    updateMusicVolume() {
        const duck = this.song && this.volumes.effects ? 0.2 : 1;
        this.musicGain.gain.setTargetAtTime(this.volumes.music / 100 * duck, this.context.currentTime, 0.08);
    }
    effectBuffer(sample) {
        let pending = this.effects.get(sample);
        if (!pending) {
            pending = getAsset(`sounds/${sample}.wav`)
                .then((response) => response.arrayBuffer())
                .then((data) => this.context.decodeAudioData(data))
                .catch(() => {
                this.effects.delete(sample);
                return undefined;
            });
            this.effects.set(sample, pending);
        }
        return pending;
    }
    preloadEffects() {
        for (const sample of SOUND_FILES)
            void this.effectBuffer(sample);
    }
    play = (sound, pitch = 0) => {
        const { context } = this;
        if (!context || document.hidden || !this.volumes.effects)
            return;
        const now = context.currentTime;
        if (now - (this.lastEffect.get(sound) ?? -1) < 0.08)
            return;
        this.lastEffect.set(sound, now);
        const choices = variants[sound];
        const sample = choices ? choices[Math.floor(Math.random() * choices.length)] : sound;
        void this.effectBuffer(sample).then((buffer) => {
            if (buffer && !document.hidden && this.volumes.effects && context.currentTime - now < 0.35) {
                this.playBuffer(buffer, pitch, this.effectsGain, context.currentTime);
            }
        });
    };
    playBuffer(buffer, pitch, output, at) {
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 2 ** (pitch / 12);
        source.connect(output);
        source.start(at);
        return source;
    }
    async playFishSong(entry, onFinish) {
        this.stopFishSong();
        const { context } = this;
        const request = this.songRequest;
        if (!context) {
            onFinish();
            return;
        }
        try {
            const samples = ["dinglo", "ding", "dinghi", "dingsuperhi", "applause"];
            const [song, buffers] = await Promise.all([
                getAsset(`fishsongs/${encodeURIComponent(entry.id)}.json`).then((response) => response.json()),
                Promise.all(samples.map((sample) => this.effectBuffer(sample))),
            ]);
            if (request !== this.songRequest)
                return;
            const start = context.currentTime + 0.025;
            const stops = [];
            const mix = new Map();
            const finish = () => {
                for (const gain of mix.values())
                    gain.disconnect();
                onFinish();
            };
            this.song = { stops, finish };
            for (const note of song.notes) {
                const tone = note.pitch <= -12 ? 0 : note.pitch >= 24 ? 3 : note.pitch >= 12 ? 2 : 1;
                const buffer = buffers[tone];
                if (!buffer)
                    continue;
                let gain = mix.get(note.volume);
                if (!gain) {
                    gain = context.createGain();
                    gain.gain.value = note.volume;
                    gain.connect(this.effectsGain);
                    mix.set(note.volume, gain);
                }
                stops.push(this.playBuffer(buffer, note.pitch - (tone - 1) * 12, gain, start + note.at / 1000));
            }
            let end = start + song.duration / 1000;
            if (entry.long && buffers[4]) {
                stops.push(this.playBuffer(buffers[4], 0, this.effectsGain, end + 0.4));
                end += 0.4 + buffers[4].duration;
            }
            this.updateMusicVolume();
            const clock = context.createConstantSource();
            clock.offset.value = 0;
            clock.connect(this.effectsGain);
            stops.push(clock);
            clock.onended = () => {
                if (request !== this.songRequest)
                    return;
                this.song = undefined;
                this.updateMusicVolume();
                finish();
            };
            clock.start(start);
            clock.stop(end + 0.15);
        }
        catch {
            if (request === this.songRequest) {
                const started = Boolean(this.song);
                this.stopFishSong();
                if (!started)
                    onFinish();
            }
        }
    }
    stopFishSong() {
        this.songRequest++;
        if (!this.song)
            return;
        for (const source of this.song.stops)
            source.stop();
        this.song.finish();
        this.song = undefined;
        this.updateMusicVolume();
    }
}
