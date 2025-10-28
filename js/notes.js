var MusicMaker = MusicMaker || {};

MusicMaker.noteNameToMidi = function(noteName) {
    const noteOffsetMap = {
        'F#': 0, 'F': -1, 'E': -2, 'D#': -3, 'D': -4, 'C#': -5, 'C': -6, 'B': -7, 'A#': -8, 'A': -9, 'G#': -10, 'G': -11, 'LF#': -12
    };
    const octaveName = noteName.replace(/[^0-9]/g, '');
    let octave = parseInt(octaveName, 10);
    let key = noteName.slice(0, -octaveName.length);

    const baseMidiFsharp0 = 18;
    const midi = baseMidiFsharp0 + octave * 12 + noteOffsetMap[key];
    return midi;
};

MusicMaker.getNoteSize = function(pitch, instrumentName) {
    const instrument = MusicMaker.instrumentData.instruments[instrumentName];
    if (!instrument || !instrument.sizeRanges) {
        return 'medium'; // Default size
    }

    const midi = MusicMaker.noteNameToMidi(pitch);
    for (const size in instrument.sizeRanges) {
        const range = instrument.sizeRanges[size];
        if (midi >= range[0] && midi <= range[1]) {
            return size;
        }
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