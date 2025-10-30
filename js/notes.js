var MusicMaker = MusicMaker || {};

MusicMaker.noteNameToMidi = function(noteName) {
    const noteValues = {
        'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };

    const match = noteName.match(/([A-G]#?)(-?\d+)/);
    if (!match) {
        if (noteName === 'LF#') return 18;
        return null;
    }

    const key = match[1];
    const octave = parseInt(match[2], 10);

    if (noteValues[key] === undefined) {
        return null;
    }

    const midi = (octave + 1) * 12 + noteValues[key];
    return midi;
};

MusicMaker.getNoteSize = function(pitch, instrumentName) {
    const instrument = MusicMaker.instrumentData.instruments[instrumentName];
    if (!instrument || !instrument.sizeRanges) {
        return 'medium'; // Default size
    }

    const midi = MusicMaker.noteNameToMidi(pitch);
    const sizes = ['tiny', 'small', 'medium', 'large', 'huge'];

    for (const size of sizes) {
        if (instrument.sizeRanges[size]) {
            const range = instrument.sizeRanges[size];
            if (midi > range[0] && midi <= range[1]) {
                return size;
            }
        }
    }
    
    const hugeRange = instrument.sizeRanges['huge'];
    if (hugeRange && midi === hugeRange[0]) {
        return 'huge';
    }


    return 'medium'; // Default size
};

MusicMaker.midiToNoteName = function(midi) {
    if (midi < 0 || midi > 127) {
        return null;
    }
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteIndex = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    return noteNames[noteIndex] + octave;
};