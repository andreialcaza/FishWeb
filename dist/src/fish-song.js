const pitches = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const beats = { z: 3, t: 6, s: 12, e: 24, q: 48, h: 96, w: 192 };
function parseDuration(value) {
    const milliseconds = /^\d+/.exec(value);
    if (milliseconds)
        return Number(milliseconds[0]);
    let duration = 0;
    for (const part of value.toLowerCase().replace(/\+$/, "").split("+")) {
        const match = /^([ztseqhw])(t?)(d*)$/.exec(part);
        if (!match)
            throw new Error(`Invalid note duration: ${value}`);
        let length = beats[match[1]];
        if (match[2])
            length = Math.floor(length * 2 / 3);
        duration += length;
        for (const _ of match[3]) {
            length = Math.floor(length / 2);
            duration += length;
        }
    }
    return duration;
}
export function parseFishSong(text) {
    const lines = Array.from({ length: 3 }, () => ({ at: 0, shift: 0, volume: 1 }));
    const notes = [];
    let line = lines[0];
    let speed = 3;
    let shift = 0;
    let title = "";
    let skipping = false;
    for (const raw of text.split(/\r?\n/)) {
        const row = raw.trim();
        if (!row || row.startsWith("#"))
            continue;
        if (row.startsWith("*")) {
            const [command, argument] = row.slice(1).split(/\s+/, 2);
            const key = command.toLowerCase();
            if (key === "skip")
                skipping = argument?.toLowerCase() === "true";
            if (key === "on")
                skipping = false;
            if (key === "off")
                skipping = true;
            if (skipping)
                continue;
            switch (key) {
                case "attrib":
                    if (argument?.toLowerCase() === "title")
                        title = row.slice(row.indexOf("=") + 1).trim();
                    break;
                case "line":
                    line = lines[Number(argument) - 1];
                    break;
                case "rest":
                    line.at = Math.max(line.at, lines[Number(argument) - 1].at);
                    break;
                case "speed":
                    speed = Number(argument);
                    break;
                case "volume":
                    line.volume = Number(argument);
                    break;
                case "shift":
                    shift = Number(argument);
                    break;
                case "localshift":
                    line.shift = Number(argument);
                    break;
            }
            continue;
        }
        if (skipping)
            continue;
        for (const token of row.split(",")) {
            if (!token.trim())
                continue;
            const match = /^([a-gr])([#b]?)(\d?)\S*\s+(\S+)$/i.exec(token.trim());
            if (!match)
                throw new Error(`Invalid note: ${token.trim()}`);
            const [, letter, accidental, octave, duration] = match;
            const note = letter.toLowerCase();
            if (note !== "r") {
                const modifier = accidental === "#" ? 1 : accidental ? -1 : 0;
                const pitch = pitches[note] + modifier + 12 * (Number(octave || "4") - 4) + shift + line.shift;
                notes.push({ at: line.at, pitch, volume: line.volume });
            }
            line.at += Math.floor(parseDuration(duration) * speed);
        }
    }
    notes.sort((a, b) => a.at - b.at);
    return { title, duration: Math.max(...lines.map(({ at }) => at)), notes };
}
