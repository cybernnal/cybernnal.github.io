var MusicMaker = MusicMaker || {};

MusicMaker.MidiImport = (function() {

    const MIDI_INSTRUMENT_NAMES = [
        "Acoustic Grand Piano", "Bright Acoustic Piano", "Electric Grand Piano", "Honky-tonk Piano", "Electric Piano 1", "Electric Piano 2", "Harpsichord", "Clavinet",
        "Celesta", "Glockenspiel", "Music Box", "Vibraphone", "Marimba", "Xylophone", "Tubular Bells", "Dulcimer",
        "Drawbar Organ", "Percussive Organ", "Rock Organ", "Church Organ", "Reed Organ", "Accordion", "Harmonica", "Tango Accordion",
        "Acoustic Guitar (nylon)", "Acoustic Guitar (steel)", "Electric Guitar (jazz)", "Electric Guitar (clean)", "Electric Guitar (muted)", "Overdriven Guitar", "Distortion Guitar", "Guitar Harmonics",
        "Acoustic Bass", "Electric Bass (finger)", "Electric Bass (pick)", "Fretless Bass", "Slap Bass 1", "Slap Bass 2", "Synth Bass 1", "Synth Bass 2",
        "Violin", "Viola", "Cello", "Contrabass", "Tremolo Strings", "Pizzicato Strings", "Orchestral Harp", "Timpani",
        "String Ensemble 1", "String Ensemble 2", "Synth Strings 1", "Synth Strings 2", "Choir Aahs", "Voice Oohs", "Synth Voice", "Orchestra Hit",
        "Trumpet", "Trombone", "Tuba", "Muted Trumpet", "French Horn", "Brass Section", "Synth Brass 1", "Synth Brass 2",
        "Soprano Sax", "Alto Sax", "Tenor Sax", "Baritone Sax", "Oboe", "English Horn", "Bassoon", "Clarinet",
        "Piccolo", "Flute", "Recorder", "Pan Flute", "Blown Bottle", "Shakuhachi", "Whistle", "Ocarina",
        "Lead 1 (square)", "Lead 2 (sawtooth)", "Lead 3 (calliope)", "Lead 4 (chiff)", "Lead 5 (charang)", "Lead 6 (voice)", "Lead 7 (fifths)", "Lead 8 (bass + lead)",
        "Pad 1 (new age)", "Pad 2 (warm)", "Pad 3 (polysynth)", "Pad 4 (choir)", "Pad 5 (bowed)", "Pad 6 (metallic)", "Pad 7 (halo)", "Pad 8 (sweep)",
        "FX 1 (rain)", "FX 2 (soundtrack)", "FX 3 (crystal)", "FX 4 (atmosphere)", "FX 5 (brightness)", "FX 6 (goblins)", "FX 7 (echoes)", "FX 8 (sci-fi)",
        "Sitar", "Banjo", "Shamisen", "Koto", "Kalimba", "Bagpipe", "Fiddle", "Shanai",
        "Tinkle Bell", "Agogo", "Steel Drums", "Woodblock", "Taiko Drum", "Melodic Tom", "Synth Drum", "Reverse Cymbal",
        "Guitar Fret Noise", "Breath Noise", "Seashore", "Bird Tweet", "Telephone Ring", "Helicopter", "Applause", "Gunshot"
    ];

    function importMidi(beforeState) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mid,audio/midi';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = e => {
                const arrayBuffer = e.target.result;
                try {
                    const midiData = MidiParser.parse(new Uint8Array(arrayBuffer));
                    processMidiData(midiData, beforeState);
                } catch (error) {
                    alert('Failed to parse MIDI file. The file may be corrupt or in an unsupported format.');
                    console.error('MIDI parsing error:', error);
                }
            };
            reader.readAsArrayBuffer(file);
        };
        input.click();
    }

    function processMidiData(midiData, beforeState) {
        const timeDivision = midiData.timeDivision;
        let tempo = 120;
        if (midiData.track.length > 0) {
            const tempoEvent = midiData.track[0].event.find(e => e.type === 0x51);
            if (tempoEvent) {
                tempo = 60000000 / tempoEvent.data;
            }
        }
        console.log('MIDI timeDivision:', timeDivision, 'tempo:', tempo);

        const scalingFactor = 10 / timeDivision;

        const notes = [];
        const instruments = new Map();
        const channelInstruments = {};

        midiData.track.forEach((track, trackIndex) => {
            let currentTime = 0;
            const activeNotes = {};

            track.event.forEach(event => {
                currentTime += event.deltaTime;

                switch (event.type) {
                    case 0xC: // Program Change
                        if (event.channel !== 9) { // Not percussion channel
                            const instrumentId = event.data;
                            const instrumentName = MIDI_INSTRUMENT_NAMES[instrumentId] || `Instrument ${instrumentId}`;
                            if (!instruments.has(instrumentId)) {
                                instruments.set(instrumentId, { name: instrumentName, id: instrumentId });
                            }
                            channelInstruments[event.channel] = instrumentId;
                        }
                        break;

                    case 0x9: // Note On
                        if (event.data[1] > 0) { // Note On with velocity > 0
                            activeNotes[event.data[0]] = {
                                start: currentTime,
                                channel: event.channel,
                                velocity: event.data[1]
                            };
                        } else { // Note On with velocity 0 is a Note Off
                            const noteNumber = event.data[0];
                            if (activeNotes[noteNumber]) {
                                const start = activeNotes[noteNumber].start;
                                const duration = currentTime - start;
                                const channel = activeNotes[noteNumber].channel;

                                if (duration > 0) {
                                    notes.push({
                                        pitch: noteNumber,
                                        start: start * scalingFactor,
                                        duration: duration * scalingFactor,
                                        instrument: channel === 9 ? 'percussion' : channelInstruments[channel],
                                        channel: channel
                                    });
                                }
                                delete activeNotes[noteNumber];
                            }
                        }
                        break;

                    case 0x8: // Note Off
                        const noteNumber = event.data[0];
                        if (activeNotes[noteNumber]) {
                            const start = activeNotes[noteNumber].start;
                            const duration = currentTime - start;
                            const channel = activeNotes[noteNumber].channel;

                            if (duration > 0) {
                                notes.push({
                                    pitch: noteNumber,
                                    start: start * scalingFactor,
                                    duration: duration * scalingFactor,
                                    instrument: channel === 9 ? 'percussion' : channelInstruments[channel],
                                    channel: channel
                                });
                            }
                            delete activeNotes[noteNumber];
                        }
                        break;
                }
            });
        });

        if (notes.some(n => n.instrument === 'percussion')) {
            instruments.set('percussion', { name: 'Percussion', id: 'percussion' });
        }

        showInstrumentModal(Array.from(instruments.values()), notes, beforeState);
    }

        

        function showInstrumentModal(instruments, notes, beforeState) {

            const modal = document.getElementById('midi-instrument-modal');

            const instrumentList = document.getElementById('midi-instrument-list');

            const confirmBtn = document.getElementById('confirm-midi-instruments');

    

            const instrumentChunks = [];

            for (let i = 0; i < instruments.length; i += 5) {

                instrumentChunks.push(instruments.slice(i, i + 5));

            }

    

            let currentChunkIndex = 0;

            const instrumentMap = {};

    

            function renderChunk() {

                instrumentList.innerHTML = '';

                const chunk = instrumentChunks[currentChunkIndex];

                chunk.forEach(inst => {

                    const div = document.createElement('div');

                    div.className = 'midi-instrument-item';

    

                    const nameInput = document.createElement('input');

                    nameInput.type = 'text';

                    nameInput.value = inst.name;

                    nameInput.dataset.instrumentId = inst.id;

    

                    const abbrInput = document.createElement('input');

                    abbrInput.type = 'text';

                    abbrInput.value = inst.name.substring(0, 3).toLowerCase();

                    abbrInput.dataset.instrumentId = inst.id;

    

                    const select = document.createElement('select');

                    const defaultOption = document.createElement('option');

                    defaultOption.value = '';

                    defaultOption.textContent = 'Select existing';

                    select.appendChild(defaultOption);

    

                    for (const instrumentName in MusicMaker.instruments) {

                        const option = document.createElement('option');

                        option.value = instrumentName;

                        option.textContent = instrumentName;

                        select.appendChild(option);

                    }

    

                    select.onchange = () => {

                        const selected = select.value;

                        if (selected) {

                            nameInput.value = selected;

                            abbrInput.value = MusicMaker.instruments[selected].exportName || selected.substring(0, 3).toLowerCase();

                        }

                    };

    

                    div.appendChild(nameInput);

                    div.appendChild(abbrInput);

                    div.appendChild(select);

                    instrumentList.appendChild(div);

                });

                modal.style.display = 'flex';

            }

    

            confirmBtn.onclick = () => {

                const chunk = instrumentChunks[currentChunkIndex];

                const nameInputs = instrumentList.querySelectorAll('input[type="text"][data-instrument-id]');

                const abbrInputs = instrumentList.querySelectorAll('input[type="text"][data-instrument-id]');

    

                const existingAbbrs = new Set(Object.values(MusicMaker.instruments).map(inst => inst.exportName));

                const newAbbrs = new Set();

    

                for (let i = 0; i < chunk.length; i++) {

                    const abbr = abbrInputs[i*2+1].value.trim();

                    if (existingAbbrs.has(abbr) || newAbbrs.has(abbr)) {

                        alert(`Abbreviation '${abbr}' is already in use. Please choose a unique abbreviation.`);

                        return;

                    }

                    newAbbrs.add(abbr);

                }

    

                for (let i = 0; i < chunk.length; i++) {

                    const inst = chunk[i];

                    const nameInput = nameInputs[i*2];

                    const abbrInput = nameInputs[i*2+1];

                    instrumentMap[inst.id] = {

                        name: nameInput.value,

                        abbreviation: abbrInput.value

                    };

                }

    

                currentChunkIndex++;

                if (currentChunkIndex < instrumentChunks.length) {

                    renderChunk();

                } else {

                    modal.style.display = 'none';

                    transformAndLoad(notes, instrumentMap, beforeState);

                }

            };

    

            if (instrumentChunks.length > 0) {

                renderChunk();

            } else {

                transformAndLoad(notes, {}, beforeState);

            }

        }

    

        function midiPitchToAppName(pitch) {

            const fSharpOctavePitchNames = ['F#', 'F', 'E', 'D#', 'D', 'C#', 'C', 'B', 'A#', 'A', 'G#', 'G', 'LF#'];

            const midiNoteToAppPitchIndex = {

                6: 0, 5: 1, 4: 2, 3: 3, 2: 4, 1: 5, 0: 6, 11: 7, 10: 8, 9: 9, 8: 10, 7: 11

            };

    

            let octave;

            if (pitch >= 66) octave = 5;

            else if (pitch >= 54) octave = 4;

            else if (pitch >= 42) octave = 3;

            else if (pitch >= 30) octave = 2;

            else octave = 1;

    

            const noteInOctave = pitch % 12;

            const appPitchIndex = midiNoteToAppPitchIndex[noteInOctave];

            const appPitchName = fSharpOctavePitchNames[appPitchIndex];

    

            return appPitchName + octave;

        }

    

        function transformAndLoad(notes, instrumentMap, beforeState) {

            const newNotes = [];

            const midiTrackLayout = {};

            let songTotalTime = 0;

    

            // Create new instruments

            for (const instId in instrumentMap) {

                const inst = instrumentMap[instId];

                if (!MusicMaker.instruments[inst.name]) {

                    MusicMaker.createCustomInstrument(inst.name, inst.abbreviation);

                }

            }

    

            notes.forEach(note => {

                const instrument = instrumentMap[note.instrument];

                if (!instrument) return;

    

                let fullPitchName;

                if (note.instrument === 'percussion') {

                    const pitchName = `Percussion ${note.pitch}`;

                    fullPitchName = 'Percussion';

                    if (!midiTrackLayout[fullPitchName]) {

                        midiTrackLayout[fullPitchName] = [];

                    }

                    if (!midiTrackLayout[fullPitchName].includes(pitchName)) {

                        midiTrackLayout[fullPitchName].push(pitchName);

                    }

                } else {

                    fullPitchName = midiPitchToAppName(note.pitch);

                    if (!midiTrackLayout[fullPitchName]) {

                        midiTrackLayout[fullPitchName] = [];

                    }

                    if (!midiTrackLayout[fullPitchName].includes(instrument.name)) {

                        midiTrackLayout[fullPitchName].push(instrument.name);

                    }

                }

            });

    

            const fullTrackLayout = {};

            const SIZES = ['tiny', 'small', 'medium', 'large', 'huge'];

            const OCTAVE_PITCH_NAMES = ['F#', 'F', 'E', 'D#', 'D', 'C#', 'C', 'B', 'A#', 'A', 'G#', 'G', 'LF#'];

            SIZES.forEach((size, index) => {

                const octaveNum = 5 - index;

                OCTAVE_PITCH_NAMES.forEach(pitchName => {

                    const fullPitchName = pitchName + octaveNum;

                    fullTrackLayout[fullPitchName] = midiTrackLayout[fullPitchName] || [];

                });

            });

    

            if (midiTrackLayout['Percussion']) {

                fullTrackLayout['Percussion'] = midiTrackLayout['Percussion'];

            }

    

            const octaveToSize = { 5: 'tiny', 4: 'small', 3: 'medium', 2: 'large', 1: 'huge' };

    

            notes.forEach(note => {

                const instrument = instrumentMap[note.instrument];

                if (!instrument) return;

    

                let pitchName, size, fullPitchName;

                if (note.instrument === 'percussion') {

                    pitchName = `Percussion ${note.pitch}`;

                    size = 'medium';

                    fullPitchName = 'Percussion';

                } else {

                    const appPitch = midiPitchToAppName(note.pitch);

                    const octave = parseInt(appPitch.slice(-1), 10);

                    pitchName = appPitch.slice(0, -1);

                    size = octaveToSize[octave] || 'medium';

                    fullPitchName = appPitch;

                }

    

                newNotes.push({

                    id: Date.now() + Math.random(),

                    size: size,

                    instrumentName: note.instrument === 'percussion' ? pitchName : instrument.name,

                    pitch: fullPitchName,

                    start: note.start,

                    duration: note.duration

                });

    

                const endTime = note.start + note.duration;

                if (endTime > songTotalTime) {

                    songTotalTime = endTime;

                }

            });

    

            MusicMaker.applyState({

                tracks: newNotes,

                songTotalTime: songTotalTime + 100,

                trackLayout: fullTrackLayout,

                instruments: MusicMaker.instruments

            });

    

            MusicMaker.commitChange(beforeState);

        }

    return {
        importMidi: importMidi
    };
})();