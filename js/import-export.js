var MusicMaker = MusicMaker || {};

MusicMaker.importTracks = function() {
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
            tracks = songData.tracks;
            songTotalTime = songData.totalTime;
            MusicMaker.createUI(songData.trackLayout); // Clear and recreate UI
            MusicMaker.renderAllNotes(); // Render the new notes
            MusicMaker.Storage.save(tracks, songTotalTime, songData.trackLayout, MusicMaker.instruments);
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

    const localTracks = [];
    let currentTime = 0;
    const parts = content.trim().replace(/\r\n/g, ' ').replace(/\n/g, ' ').split(/\s+/);
    const trackLayout = {};

    parts.forEach(part => {
        if (!part) return;

        const [noteInfo, durationStr] = part.split(',');
        const duration = Number(durationStr);

        if (isNaN(duration)) {
            throw new Error(`Invalid number format in part: ${part}`);
        }

        if (noteInfo.toLowerCase() === 'x') {
            currentTime += duration;
        } else {
            const sizeCode = noteInfo.charAt(0);
            const size = sizeMap[sizeCode];
            const instrumentCode = noteInfo.charAt(1);
            const octave = sizeToOctave[size];
            const pitchName = noteInfo.substring(2);
            const instrumentName = instrumentMap[instrumentCode] || 'diapason';
            const fullPitchName = pitchName + octave;

            const newNote = {
                id: Date.now() + Math.random(),
                size: size,
                instrumentName: instrumentName,
                pitch: fullPitchName, // e.g., C + 5 = C5
                start: currentTime,
                duration: duration
            };
            localTracks.push(newNote);

            if (!trackLayout[fullPitchName]) {
                trackLayout[fullPitchName] = [];
            }
            if (!trackLayout[fullPitchName].includes(instrumentName)) {
                trackLayout[fullPitchName].push(instrumentName);
            }
        }
    });

    return { tracks: localTracks, totalTime: currentTime, trackLayout: trackLayout };
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
            exportParts.push(`x,${delay}`);
        }

        const notesAtTime = groupedByTime[time];
        notesAtTime.forEach(note => {
            const pitchName = note.pitch.slice(0, -1);
            const octave = note.pitch.slice(-1);
            const size = octaveToSize[octave];
            const sizeCode = sizeReverseMap[size];
            const instrumentCode = instrumentReverseMap[note.instrumentName];
            exportParts.push(`${sizeCode}${instrumentCode}${pitchName},${note.duration}`);
        });

        lastTime = time;
    });

    const finalDelay = totalTime - lastTime;
    if (finalDelay > 0) {
        exportParts.push(`x,${finalDelay}`);
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
        `<pre id="song-data">${pasteContent}</pre>
        <button id="downloadBtn">Download .song</button>
        <script>
            document.getElementById('downloadBtn').addEventListener('click', () => {
                const text = document.getElementById('song-data').textContent;
                const blob = new Blob([text], { type: 'text/plain' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'music.song';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
</script>`
    );
    newTab.document.close();
};