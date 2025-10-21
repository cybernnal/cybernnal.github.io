var MusicMaker = MusicMaker || {};

// The 13 pitches that make up a single user-defined "octave"
const OCTAVE_PITCH_NAMES = ['F#', 'F', 'E', 'D#', 'D', 'C#', 'C', 'B', 'A#', 'A', 'G#', 'G', 'LF#'];
const SIZES = ['tiny', 'small', 'medium', 'large', 'huge'];

// Base Hues (0-360) for each instrument
const INSTRUMENT_HUES = {
    'diapason': 210, // blue
    'gamba': 140,    // green
    'steam whistle': 30, // orange
    'nasard': 280,   // purple
    'trompette': 0,      // red
    'subbass': 170,    // teal
    'vox humana': 330,   // pink
    'gedeckt': 50,     // yellow
    'posaune': 30,     // brown (orange hue, lower saturation)
    'piccolo': 190     // cyan
};

MusicMaker.createUI = function() {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = ''; // Clear previous UI

    // Loop through each size to create 5 distinct blocks
    SIZES.forEach((size, index) => {
        const octaveNum = 5 - index; // 5 for tiny, 4 for small, etc.

        // Create the rows for this octave block
        OCTAVE_PITCH_NAMES.forEach(pitchName => {
            const fullPitchName = pitchName + octaveNum;
            const track = document.createElement('div');
            track.className = 'track';
            track.dataset.pitch = fullPitchName;

            const trackHeader = document.createElement('div');
            trackHeader.className = 'track-header';

            const key = document.createElement('div');
            const isBlackKey = pitchName.includes('#');
            key.className = isBlackKey ? 'key key--black' : 'key key--white';
            key.textContent = fullPitchName;

            trackHeader.appendChild(key);

            const timeline = document.createElement('div');
            timeline.className = 'timeline';

            timeline.addEventListener('dblclick', (e) => {
                const newNote = {
                    id: Date.now() + Math.random(),
                    instrumentName: 'diapason', // default
                    size: size,
                    pitch: fullPitchName,
                    start: e.offsetX / stepWidth, // Convert pixel offset to time unit
                    duration: 0.5 // New default duration
                };
                tracks.push(newNote);
                MusicMaker.renderNote(newNote);
            });

            track.appendChild(trackHeader);
            track.appendChild(timeline);
            appContainer.appendChild(track);
        });

        // Add a separator after each block, except the last one
        if (index < SIZES.length - 1) {
            const separator = document.createElement('div');
            separator.className = 'octave-separator';
            appContainer.appendChild(separator);
        }
    });
};

MusicMaker.renderNote = function(note) {
    const timeline = document.querySelector(`.track[data-pitch="${note.pitch}"] .timeline`);
    if (!timeline) return;

    const noteElement = document.createElement('div');
    noteElement.className = 'note';
    noteElement.textContent = `${note.instrumentName[0]}${note.size[0]}`;

    // --- Color Calculation Logic ---
    const hue = INSTRUMENT_HUES[note.instrumentName] || 200; // Default to a neutral blue
    const pitchIndex = OCTAVE_PITCH_NAMES.indexOf(note.pitch.slice(0, -1));
    const lightness = 85 - (pitchIndex * 3.5);
    const saturation = (note.instrumentName === 'posaune') ? 40 : 70; // Lower saturation for Posaune

    noteElement.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    noteElement.style.borderColor = `hsl(${hue}, ${saturation}%, ${lightness - 20}%)`; // Darker border
    // --- End of Color Logic ---

    noteElement.style.left = (note.start * stepWidth) + 'px';
    noteElement.style.width = (note.duration * stepWidth) + 'px';
    noteElement.dataset.noteId = note.id;

    timeline.appendChild(noteElement);
}

MusicMaker.renderAllNotes = function() {
    document.querySelectorAll('.note').forEach(el => el.remove());
    tracks.forEach(note => MusicMaker.renderNote(note));
};