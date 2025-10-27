var MusicMaker = MusicMaker || {};

MusicMaker.instrumentData = {
  "instruments": {
    "diapason": {
      "hue": 210,
      "saturation": 70,
      "exportName": "d",
      "noteRange": [30, 78],
      "sizeRanges": {
        "tiny": [66, 78],
        "small": [54, 66],
        "medium": [42, 54],
        "large": [30, 42],
        "huge": [18, 30]
      }
    },
    "gamba": {
      "hue": 140,
      "saturation": 70,
      "exportName": "g",
      "noteRange": [42, 90],
      "sizeRanges": {
        "tiny": [78, 90],
        "small": [66, 78],
        "medium": [54, 66],
        "large": [42, 54],
        "huge": [30, 42]
      }
    },
    "steam whistle": {
      "hue": 30,
      "saturation": 70,
      "exportName": "w",
      "noteRange": [30, 66],
      "sizeRanges": {
        "small": [54, 66],
        "medium": [42, 54],
        "large": [30, 42]
      }
    },
    "nasard": {
      "hue": 280,
      "saturation": 70,
      "exportName": "n",
      "noteRange": [49, 109],
      "sizeRanges": {
        "tiny": [97, 109],
        "small": [85, 97],
        "medium": [73, 85],
        "large": [61, 73],
        "huge": [49, 61]
      }
    },
    "trompette": {
      "hue": 0,
      "saturation": 70,
      "exportName": "t",
      "noteRange": [30, 78],
      "sizeRanges": {
        "tiny": [66, 78],
        "small": [54, 66],
        "medium": [42, 54],
        "large": [30, 42],
        "huge": [18, 30]
      }
    },
    "subbass": {
      "hue": 170,
      "saturation": 70,
      "exportName": "b",
      "noteRange": [18, 66],
      "sizeRanges": {
        "small": [54, 66],
        "medium": [42, 54],
        "large": [30, 42],
        "huge": [18, 30]
      }
    },
    "vox humana": {
      "hue": 330,
      "saturation": 70,
      "exportName": "v",
      "noteRange": [30, 78],
      "sizeRanges": {
        "tiny": [66, 78],
        "small": [54, 66],
        "medium": [42, 54],
        "large": [30, 42],
        "huge": [18, 30]
      }
    },
    "gedeckt": {
      "hue": 50,
      "saturation": 70,
      "exportName": "k",
      "noteRange": [30, 78],
      "sizeRanges": {
        "tiny": [66, 78],
        "small": [54, 66],
        "medium": [42, 54],
        "large": [30, 42],
        "huge": [18, 30]
      }
    },
    "posaune": {
      "hue": 30,
      "saturation": 40,
      "exportName": "p",
      "noteRange": [6, 54],
      "sizeRanges": {
        "small": [42, 54],
        "medium": [30, 42],
        "large": [18, 30],
        "huge": [6, 18]
      }
    },
    "piccolo": {
      "hue": 190,
      "saturation": 70,
      "exportName": "o",
      "noteRange": [54, 102],
      "sizeRanges": {
          "tiny": [90, 102],
          "small": [78, 90],
          "medium": [66, 78],
          "large": [54, 66],
          "huge": [42, 54]
      }
    }
  }
};

MusicMaker.noteNameToMidi = function(noteName) {
    const noteMap = {
        'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    // Supports formats like F#5, F#(-1)
    const match = noteName.trim().match(/([A-G]#?)\s*\(?(-?\d+)\)?/);
    if (!match) return null;

    const note = match[1];
    const octave = parseInt(match[2], 10);
    const noteIndex = noteMap[note];

    if (noteIndex === undefined) return null;

    return 12 * (octave + 1) + noteIndex;
};

MusicMaker.midiToNoteName = function(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return noteNames[noteIndex] + octave;
};

MusicMaker.getNoteSize = function(pitch, instrumentName) {
    const midi = MusicMaker.noteNameToMidi(pitch);
    const instrument = MusicMaker.instrumentData.instruments[instrumentName];
    if (!instrument || !instrument.sizeRanges) return null;

    for (const size in instrument.sizeRanges) {
        const range = instrument.sizeRanges[size];
        if (midi >= range[0] && midi <= range[1]) {
            return size;
        }
    }
    return null;
};