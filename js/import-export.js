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
            MusicMaker.notes = songData.tracks;
            songTotalTime = songData.totalTime;

            const bestTempo = MusicMaker.findBestTempo(songData.allDurations);
            MusicMaker.setTempo(bestTempo);

            MusicMaker.createUI(songData.trackLayout);
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
    const sizeToOctave = { 'tiny': 5, 'small': 4, 'medium': 3, 'large': 2, 'huge': 1 };
    const instrumentMap = {
        d: 'diapason', g: 'gamba', w: 'steam whistle', n: 'nasard', t: 'trompette',
        b: 'subbass', v: 'vox humana', k: 'gedeckt', p: 'posaune', o: 'piccolo'
    };
    const PITCH_NAMES = new Set(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'LF#']);

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
            console.error(`Invalid number format in part: ${part}`);
            return;
        }
        allDurations.push(duration);

        if (noteInfo.toLowerCase() === 'x') {
            currentTime += duration;
        } else {
            const sizeCode = noteInfo.charAt(0);
            const size = sizeMap[sizeCode];
            const octave = sizeToOctave[size];

            let rest = noteInfo.substring(1);
            let pitchName, exportName;

            if (rest.length > 1 && PITCH_NAMES.has(rest.slice(-2))) {
                pitchName = rest.slice(-2);
                exportName = rest.slice(0, -2);
            } else if (PITCH_NAMES.has(rest.slice(-1))) {
                pitchName = rest.slice(-1);
                exportName = rest.slice(0, -1);
            } else {
                console.error('Failed to parse note info:', noteInfo);
                return;
            }

            let instrumentName = exportNameToDisplayName[exportName];
            if (!instrumentName) {
                instrumentName = exportName;
                if (!MusicMaker.instruments[instrumentName]) {
                    MusicMaker.createCustomInstrument(instrumentName, exportName);
                    exportNameToDisplayName[exportName] = instrumentName;
                }
            }
            
            const fullPitchName = pitchName + octave;

            if(!size || !instrumentName || !fullPitchName) {
                console.error('Failed to parse note:', part);
                return;
            }

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
    });

    return { tracks: localTracks, totalTime: maxTime + 100, trackLayout: trackLayout, allDurations: allDurations };
};

MusicMaker.exportTracks = function(songData) {
    const sizeReverseMap = { 'tiny': 't', 'small': 's', 'medium': 'm', 'large': 'l', 'huge': 'h' };
    const octaveToSize = { 5: 'tiny', 4: 'small', 3: 'medium', 2: 'large', 1: 'huge' };
    const instrumentReverseMap = {
        'diapason': 'd', 'gamba': 'g', 'steam whistle': 'w', 'nasard': 'n', 'trompette': 't',
        'subbass': 'b', 'vox humana': 'v', 'gedeckt': 'k', 'posaune': 'p', 'piccolo': 'o'
    };

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
            const pitchName = note.pitch.slice(0, -1);
            const octave = note.pitch.slice(-1);
            const size = octaveToSize[octave];
            const sizeCode = sizeReverseMap[size];
            
            let instrumentCode = instrumentReverseMap[note.instrumentName];
            if (!instrumentCode) {
                const customInstrument = MusicMaker.instruments[note.instrumentName];
                if (customInstrument) {
                    instrumentCode = customInstrument.exportName;
                }
            }

            if (instrumentCode) {
                exportParts.push(`${sizeCode}${instrumentCode}${pitchName},${Number(note.duration.toFixed(2))}`);
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