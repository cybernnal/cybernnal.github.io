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

    

                const fileInfo = {

                    name: file.name,

                    size: file.size,

                    lastModified: new Date(file.lastModified).toLocaleString()

                };

    

                const reader = new FileReader();

                reader.onload = e => {

                    const arrayBuffer = e.target.result;

                    try {

                        const midiData = MidiParser.parse(new Uint8Array(arrayBuffer));

                        processMidiData(midiData, fileInfo, beforeState);

                    } catch (error) {

                        alert('Failed to parse MIDI file. The file may be corrupt or in an unsupported format.');

                    }

                };

                reader.readAsArrayBuffer(file);

            };

            input.click();

        }

    

        function processMidiData(midiData, fileInfo, beforeState) {

            const timeDivision = midiData.timeDivision;

            let tempo = 120;

            if (midiData.track.length > 0) {

                const tempoEvent = midiData.track[0].event.find(e => e.type === 0x51);

                if (tempoEvent) {

                    tempo = 60000000 / tempoEvent.data;

                }

            }

            const scalingFactor = 10 / timeDivision;

    

            const notes = [];

            const instruments = new Map();

            const channelInstruments = {};

    

            let minPitch = Infinity;

            let maxPitch = -Infinity;

            const pitches = new Set();

    

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

                                const pitch = event.data[0];

                                pitches.add(pitch);

                                if (pitch < minPitch) minPitch = pitch;

                                if (pitch > maxPitch) {

                                    maxPitch = pitch;

                                }

                                activeNotes[pitch] = {

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

    

            showTranspositionModal(notes, instruments, minPitch, maxPitch, pitches, fileInfo, beforeState);

        }

    

            function showTranspositionModal(notes, instruments, minPitch, maxPitch, pitches, fileInfo, beforeState) {

    

                const modal = document.getElementById('midi-transposition-modal');

    

                const analysisEl = document.getElementById('transposition-analysis');

    

                const semitonesInput = document.getElementById('transpose-semitones');

    

                const infoEl = document.getElementById('transposition-info');

    

                                const confirmBtn = document.getElementById('confirm-transposition');

    

                

    

                                const APP_MIN_PITCH = 6; // F#-1

    

                                const APP_MAX_PITCH = 109; // C#8

    

                const APP_RANGE = APP_MAX_PITCH - APP_MIN_PITCH;

    

        

    

                const sortedPitches = [...pitches].sort((a, b) => a - b);

    

                analysisEl.innerHTML = `

    

                    This MIDI has notes from ${MusicMaker.midiToNoteName(minPitch)} (pitch ${minPitch}) to ${MusicMaker.midiToNoteName(maxPitch)} (pitch ${maxPitch}). <br><br> 

    

                    Unique pitches found (${sortedPitches.length}): ${sortedPitches.join(', ')}

    

                `;

    

        

    

                const midiRange = maxPitch - minPitch;

    

                let bestFit = 0;

    

                if (midiRange > APP_RANGE) {

    

                    // Center the MIDI range in the app range

    

                    const midiCenter = (minPitch + maxPitch) / 2;

    

                    const appCenter = (APP_MIN_PITCH + APP_MAX_PITCH) / 2;

    

                    bestFit = Math.round(appCenter - midiCenter);

    

                } else {

    

                    // Fit the whole MIDI range in the app range

    

                    if (minPitch < APP_MIN_PITCH) {

    

                        bestFit = APP_MIN_PITCH - minPitch;

    

                    } else if (maxPitch > APP_MAX_PITCH) {

    

                        bestFit = APP_MAX_PITCH - maxPitch;

    

                    }

    

                }

    

        

    

                semitonesInput.value = bestFit;

    

        

    

                function updateInfo() {

    

                    const transposeBy = parseInt(semitonesInput.value, 10) || 0;

    

                    const newMin = minPitch + transposeBy;

    

                    const newMax = maxPitch + transposeBy;

    

        

    

                    let clippedLow = 0;

    

                    let clippedHigh = 0;

    

        

    

                    notes.forEach(note => {

    

                        const newPitch = note.pitch + transposeBy;

    

                        if (newPitch < APP_MIN_PITCH) clippedLow++;

    

                        if (newPitch > APP_MAX_PITCH) clippedHigh++;

    

                    });

    

        

    

                    let infoText = `The new range will be ${MusicMaker.midiToNoteName(newMin)} to ${MusicMaker.midiToNoteName(newMax)}.`;

    

                    if (clippedLow > 0 || clippedHigh > 0) {

    

                        infoText += ` Warning: ${clippedLow} notes will be below the playable range and ${clippedHigh} notes will be above.`;

    

                    }

    

                    infoEl.textContent = infoText;

    

                }

    

        

    

                updateInfo();

    

        

    

                semitonesInput.oninput = updateInfo;

    

        

    

                confirmBtn.onclick = () => {

    

                    const transposeBy = parseInt(semitonesInput.value, 10) || 0;

    

                    const playableNotes = [];

    

                    const clippedNotes = [];

    

        

    

                    notes.forEach(note => {

    

                        const newPitch = note.pitch + transposeBy;

    

                        const newNote = { ...note, pitch: newPitch };

    

                        if (newPitch < APP_MIN_PITCH || newPitch > APP_MAX_PITCH) {

    

                            newNote.isClipped = true;

    

                            clippedNotes.push(newNote);

    

                        } else {

    

                            playableNotes.push(newNote);

    

                        }

    

                    });

    

        

    

                                            modal.style.display = 'none';

    

        

    

                                

    

        

    

                                            if (clippedNotes.length > 0) {

    

        

    

                                                const confirmed = confirm(`${clippedNotes.length} notes are outside the playable range. You can use an external editor to fix the file first.\n\nClick 'OK' to clip the notes and continue, or 'Cancel' to stop the import.`);

    

        

    

                                                if (confirmed) {

    

        

    

                                                    showInstrumentModal(Array.from(instruments.values()), playableNotes, beforeState);

    

        

    

                                                }

    

        

    

                                            } else {

    

        

    

                                                showInstrumentModal(Array.from(instruments.values()), playableNotes, beforeState);

    

        

    

                                            }

    

        

    

                            };

    

        

    

                    

    

        

    

                            modal.style.display = 'flex';

    

        

    

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

    

        

    

        // Check if an instrument with the same name already exists

    

        if (MusicMaker.instruments[inst.name]) {

    

            select.value = inst.name;

    

            abbrInput.value = MusicMaker.instruments[inst.name].exportName || inst.name.substring(0, 3).toLowerCase();

    

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

    

            const nameInputs = Array.from(instrumentList.querySelectorAll('input[type="text"][data-instrument-id]')).filter((v, i) => i % 2 === 0);

    

            const abbrInputs = Array.from(instrumentList.querySelectorAll('input[type="text"][data-instrument-id]')).filter((v, i) => i % 2 !== 0);

    

        

    

            const existingInstruments = MusicMaker.instruments;

    

            const newInstrumentData = new Map();

    

        

    

            for (let i = 0; i < chunk.length; i++) {

    

                const name = nameInputs[i].value.trim();

    

                const abbr = abbrInputs[i].value.trim();

    

                const instId = chunk[i].id;

    

        

    

                const existingInst = existingInstruments[name];

    

                if (existingInst) {

    

                    if (existingInst.exportName !== abbr) {

    

                        alert(`Instrument '${name}' already exists with a different abbreviation ('${existingInst.exportName}'). Please use the existing abbreviation or choose a different name.`);

    

                        return;

    

                    }

    

                }

    

                newInstrumentData.set(instId, { name, abbreviation: abbr });

    

            }

    

        

    

            for (const [instId, data] of newInstrumentData.entries()) {

    

                instrumentMap[instId] = data;

    

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

    

        

    

                                    if (!instrument) {

    

        

    

                                        return;

    

        

    

                                    }

    

        

    

                        

    

        

    

                                    let fullPitchName;

    

        

    

                                    if (note.isClipped) {
                                        fullPitchName = `Clipped: ${MusicMaker.midiToNoteName(note.pitch)}`;
                                    } else if (note.instrument === 'percussion') {

    

        

    

                                        const pitchName = `Percussion ${note.pitch}`;

    

        

    

                                        fullPitchName = 'Percussion';

    

        

    

                                        if (!midiTrackLayout[fullPitchName]) {

    

        

    

                                            midiTrackLayout[fullPitchName] = [];

    

        

    

                                        }

    

        

    

                                        if (!midiTrackLayout[fullPitchName].includes(pitchName)) {

    

        

    

                                            midiTrackLayout[fullPitchName].push(pitchName);

    

        

    

                                        }

    

        

    

                                    } else {

    

        

    

                                        fullPitchName = MusicMaker.midiToNoteName(note.pitch);

    

        

    

                                        if (!midiTrackLayout[fullPitchName]) {

    

        

    

                                            midiTrackLayout[fullPitchName] = [];

    

        

    

                                        }

    

        

    

                                        if (!midiTrackLayout[fullPitchName].includes(instrument.name)) {

    

        

    

                                            midiTrackLayout[fullPitchName].push(instrument.name);

    

        

    

                                        }

    

        

    

                                    }

    

        

    

                        const newNote = {

    

        

    

                            id: Date.now() + Math.random(),

    

        

    

                            instrumentName: note.instrument === 'percussion' ? `Percussion ${note.pitch}` : instrument.name,

    

        

    

                            pitch: fullPitchName,

    

        

    

                            start: note.start,

    

        

    

                            duration: note.duration

    

        

    

                        };

    

                                                newNotes.push(newNote);

    

        

    

                        const endTime = note.start + note.duration;

    

        

    

                        if (endTime > songTotalTime) {

    

        

    

                            songTotalTime = endTime;

    

        

    

                        }

    

        

    

                    });

    

        

    

                    const fullTrackLayout = {};

                    MusicMaker.ALL_PITCH_NAMES.forEach(pitchName => {

                        fullTrackLayout[pitchName] = midiTrackLayout[pitchName] || [];

                    });

            

    

        

    

                    if (midiTrackLayout['Percussion']) {

    

        

    

                        fullTrackLayout['Percussion'] = midiTrackLayout['Percussion'];

    

        

    

                    }

    

        

    

            

    

        

    

                    notes.forEach(note => {
                        if (note.instrument === 'percussion') {
                            const pitchName = `Percussion ${note.pitch}`;
                            if (!MusicMaker.instruments[pitchName]) {
                                const exportName = `p${note.pitch}`;
                                MusicMaker.createCustomInstrument(pitchName, exportName);
                            }
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