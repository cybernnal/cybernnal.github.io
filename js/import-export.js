var MusicMaker = MusicMaker || {};

MusicMaker.importTracks = function(beforeState) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.song,text/plain';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            const content = e.target.result;
            const songData = MusicMaker.parseAndLoadSong(content);

            const trackPitches = MusicMaker.ALL_PITCH_NAMES.filter(pitch => songData.trackLayout.hasOwnProperty(pitch));

            MusicMaker.createUI(trackPitches, songData.trackLayout);

            MusicMaker.notes = songData.tracks;
            songTotalTime = songData.totalTime;

            const bestTempo = MusicMaker.findBestTempo(songData.allDurations);
            MusicMaker.setTempo(bestTempo);

            MusicMaker.populateInstrumentSelector();
            MusicMaker.setupEventListeners();
            
            MusicMaker.renderAllNotes();
            updateTimelineWidth();

            const parentTracks = document.querySelectorAll('.parent-track');
            parentTracks.forEach(parent => {
                const pitch = parent.dataset.pitch;
                const childTracks = document.querySelectorAll(`.child-track[data-pitch="${pitch}"]`);
                if (childTracks.length > 0) {
                    const expandBtn = parent.querySelector('.expand-btn');
                    if (expandBtn) {
                        expandBtn.click();
                    }
                }
            });

            MusicMaker.updateCursor(0);
            MusicMaker.commitChange(beforeState);
        };
        reader.readAsText(file);
    };
    input.click();
}

MusicMaker.parseAndLoadSong = function(content) {
    const sizeMap = { t: 'tiny', s: 'small', m: 'medium', l: 'large', h: 'huge' };
    const instrumentMap = {
        d: 'diapason', g: 'gamba', w: 'steam whistle', n: 'nasard', t: 'trompette',
        b: 'subbass', v: 'vox humana', k: 'gedeckt', p: 'posaune', o: 'piccolo'
    };
    const OCTAVE_PITCH_NAMES = ['F#', 'F', 'E', 'D#', 'D', 'C#', 'C', 'B', 'A#', 'A', 'G#', 'G', 'LF#'];

    const exportNameToDisplayName = {};
    for (const code in instrumentMap) {
        exportNameToDisplayName[code] = instrumentMap[code];
    }
    for (const displayName in MusicMaker.instruments) {
        const instrument = MusicMaker.instruments[displayName];
        if (instrument.exportName) {
            exportNameToDisplayName[instrument.exportName] = displayName;
        }
    }

    const localTracks = [];
    const allDurations = [];
    let currentTime = 0;
    let maxTime = 0;
    const parts = content.replace(/\r\n/g, ' ').replace(/\n/g, ' ').split(/\s+/).filter(p => p);
    const trackLayout = {};

    parts.forEach(part => {
        if (!part) return;

        const [noteInfo, durationStr] = part.split(',');
        const duration = Number(durationStr);

        if (isNaN(duration)) {
            return;
        }
        allDurations.push(duration);

        if (noteInfo.toLowerCase() === 'x') {
            currentTime += duration;
        } else {
            if (noteInfo.startsWith('undefined') || noteInfo.charAt(0) === 'p') {
                let exportName;
                if (noteInfo.startsWith('undefined')) {
                    exportName = noteInfo.substring('undefined'.length).replace('Percussio', '');
                } else {
                    exportName = noteInfo.substring(1);
                }

                let instrumentName = exportNameToDisplayName[exportName];
                if (!instrumentName) {
                    instrumentName = exportName;
                    if (!MusicMaker.instruments[instrumentName]) {
                        MusicMaker.createCustomInstrument(instrumentName, exportName);
                        exportNameToDisplayName[exportName] = instrumentName;
                    }
                }

                const newNote = {
                    id: Date.now() + Math.random(),
                    instrumentName: instrumentName,
                    pitch: 'Percussion',
                    start: currentTime,
                    duration: duration
                };
                localTracks.push(newNote);
                maxTime = Math.max(maxTime, currentTime + duration);

                if (!trackLayout['Percussion']) {
                    trackLayout['Percussion'] = [];
                }
                if (!trackLayout['Percussion'].includes(instrumentName)) {
                    trackLayout['Percussion'].push(instrumentName);
                }
            } else {
                const sizeCode = noteInfo.charAt(0);
                const size = sizeMap[sizeCode];
                const instrumentCode = noteInfo.charAt(1);
                const instrumentName = exportNameToDisplayName[instrumentCode];
                
                let rest = noteInfo.substring(2);
                let pitchName;

                if (rest.length > 1 && OCTAVE_PITCH_NAMES.includes(rest.slice(-2))) {
                    pitchName = rest.slice(-2);
                } else if (OCTAVE_PITCH_NAMES.includes(rest.slice(-1))) {
                    pitchName = rest.slice(-1);
                } else {
                    return;
                }

                if(!size || !instrumentName || !pitchName) {
                    return;
                }

                const pitchIndex = OCTAVE_PITCH_NAMES.indexOf(pitchName);
                const range = MusicMaker.instrumentData.instruments[instrumentName].sizeRanges[size];
                const midi = range[1] - pitchIndex;
                const fullPitchName = MusicMaker.midiToNoteName(midi);

                const newNote = {
                    id: Date.now() + Math.random(),
                    size: size,
                    instrumentName: instrumentName,
                    pitch: fullPitchName,
                    start: currentTime,
                    duration: duration
                };
                localTracks.push(newNote);

                maxTime = Math.max(maxTime, currentTime + duration);

                if (!trackLayout[fullPitchName]) {
                    trackLayout[fullPitchName] = [];
                }
                if (!trackLayout[fullPitchName].includes(instrumentName)) {
                    trackLayout[fullPitchName].push(instrumentName);
                }
            }
        }
    });

    return { tracks: localTracks, totalTime: maxTime + 100, trackLayout: trackLayout, allDurations: allDurations };
};
MusicMaker.exportTracks = function(songData) {
    const sizeReverseMap = { 'tiny': 't', 'small': 's', 'medium': 'm', 'large': 'l', 'huge': 'h' };
    const instrumentReverseMap = {
        'diapason': 'd', 'gamba': 'g', 'steam whistle': 'w', 'nasard': 'n', 'trompette': 't',
        'subbass': 'b', 'vox humana': 'v', 'gedeckt': 'k', 'posaune': 'p', 'piccolo': 'o'
    };
    const OCTAVE_PITCH_NAMES = ['F#', 'F', 'E', 'D#', 'D', 'C#', 'C', 'B', 'A#', 'A', 'G#', 'G', 'LF#'];

    const tracks = songData.tracks;
    const totalTime = songData.totalTime;

    if (!tracks || tracks.length === 0) {
        alert('No notes to export.');
        return;
    }

    const sortedTracks = [...tracks].sort((a, b) => a.start - b.start);

    let exportParts = [];
    let lastTime = 0;

    const groupedByTime = sortedTracks.reduce((acc, note) => {
        acc[note.start] = acc[note.start] || [];
        acc[note.start].push(note);
        return acc;
    }, {});

    const timeKeys = Object.keys(groupedByTime).map(parseFloat).sort((a, b) => a - b);

    timeKeys.forEach(time => {
        const delay = time - lastTime;
        if (delay > 0) {
            exportParts.push(`x,${Number(delay.toFixed(2))}`);
        }

        const notesAtTime = groupedByTime[time];
        notesAtTime.forEach(note => {
            if (note.pitch === 'Percussion') {
                let instrumentCode = instrumentReverseMap[note.instrumentName];
                if (!instrumentCode) {
                    const customInstrument = MusicMaker.instruments[note.instrumentName];
                    if (customInstrument) {
                        instrumentCode = customInstrument.exportName;
                    }
                }
                if (instrumentCode) {
                    exportParts.push(`p${instrumentCode},${Number(note.duration.toFixed(2))}`);
                }
            } else {
                const size = MusicMaker.getNoteSize(note.pitch, note.instrumentName);
                const sizeCode = sizeReverseMap[size];
                
                let instrumentCode = instrumentReverseMap[note.instrumentName];
                if (!instrumentCode) {
                    const customInstrument = MusicMaker.instruments[note.instrumentName];
                    if (customInstrument) {
                        instrumentCode = customInstrument.exportName;
                    }
                }

                if (instrumentCode && sizeCode) {
                    const midi = MusicMaker.noteNameToMidi(note.pitch);
                    const range = MusicMaker.instrumentData.instruments[note.instrumentName].sizeRanges[size];
                    const pitchName = OCTAVE_PITCH_NAMES[range[1] - midi];
                    exportParts.push(`${sizeCode}${instrumentCode}${pitchName},${Number(note.duration.toFixed(2))}`);
                }
            }
        });

        lastTime = time;
    });

    const finalDelay = totalTime - lastTime;
    if (finalDelay > 0) {
        exportParts.push(`x,${Number(finalDelay.toFixed(2))}`);
    }

    let result = '';
    exportParts.forEach((part, index) => {
        result += part + ' ';
        if ((index + 1) % 8 === 0) {
            result += '\n';
        }
    });

    const pasteContent = result.trim();
    const newTab = window.open();
    newTab.document.open();
    newTab.document.write(
        `<pre id="song-data">${pasteContent}</pre>\n        <button id="downloadBtn">Download .song</button>\n        <script>\n            document.getElementById('downloadBtn').addEventListener('click', () => {\n                const text = document.getElementById('song-data').textContent;\n                const blob = new Blob([text], { type: 'text/plain' });\n                const a = document.createElement('a');\n                a.href = URL.createObjectURL(blob);\n                a.download = 'music.song';\n                document.body.appendChild(a);\n                a.click();\n                document.body.removeChild(a);\n            });\n</script>`
    );
    newTab.document.close();
};