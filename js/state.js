var MusicMaker = MusicMaker || {};

MusicMaker.state = {
    tracks: [],
    songTotalTime: 0,
    instruments: {},
    trackLayout: null,
    collapseState: {},
    volume: 1,
    undoStack: [],
    redoStack: [],
    UNDO_LIMIT: 20
};

MusicMaker.createSnapshot = function() {
    // getTrackLayout now updates state, so we call it to get the latest layout info
    const { layout, collapseState } = MusicMaker.getTrackLayout();
    return {
        tracks: JSON.parse(JSON.stringify(MusicMaker.state.tracks)),
        songTotalTime: MusicMaker.state.songTotalTime,
        trackLayout: layout,
        instruments: JSON.parse(JSON.stringify(MusicMaker.state.instruments)),
        collapseState: collapseState,
        volume: MusicMaker.state.volume
    };
}

MusicMaker.commitChange = function(beforeState) {
    if (MusicMaker.state.undoStack.length >= MusicMaker.state.UNDO_LIMIT) {
        MusicMaker.state.undoStack.shift();
    }
    MusicMaker.state.undoStack.push(beforeState);
    MusicMaker.state.redoStack = [];

    // Ensure layout in state is up-to-date with the DOM before saving
    MusicMaker.getTrackLayout(); 

    MusicMaker.Storage.save(MusicMaker.state);
}

MusicMaker.undo = function() {
    if (MusicMaker.state.undoStack.length > 0) {
        const currentState = MusicMaker.createSnapshot();
        MusicMaker.state.redoStack.push(currentState);

        const previousState = MusicMaker.state.undoStack.pop();
        MusicMaker.applyState(previousState);
        MusicMaker.Storage.save(MusicMaker.state);
    }
}

MusicMaker.redo = function() {
    if (MusicMaker.state.redoStack.length > 0) {
        const currentState = MusicMaker.createSnapshot();
        MusicMaker.state.undoStack.push(currentState);

        const nextState = MusicMaker.state.redoStack.pop();
        MusicMaker.applyState(nextState);
        MusicMaker.Storage.save(MusicMaker.state);
    }
}

MusicMaker.applyState = function(state) {
    // Update the central state from the snapshot
    MusicMaker.state.tracks = state.tracks || [];
    MusicMaker.state.songTotalTime = state.songTotalTime || 0;
    MusicMaker.state.instruments = state.instruments || {};
    MusicMaker.state.trackLayout = state.trackLayout || null;
    MusicMaker.state.collapseState = state.collapseState || {};
    MusicMaker.state.volume = state.volume || 1;

    // Rebuild UI from the new state
    const trackPitches = state.trackLayout ? MusicMaker.ALL_PITCH_NAMES.filter(pitch => state.trackLayout.hasOwnProperty(pitch)) : null;
    MusicMaker.createUI(trackPitches, state.trackLayout, state.collapseState);

    MusicMaker.populateInstrumentSelector();

    // Re-attach event listeners to the new DOM
    MusicMaker.setupEventListeners();
    MusicMaker.setupCursorEventListeners();

    // Ensure tracks exist for all notes before rendering
    const tracksToCreate = new Map();
    MusicMaker.state.tracks.forEach(note => {
        const trackExists = MusicMaker.tracks.some(t => t.pitch === note.pitch && t.instrumentName === note.instrumentName);
        if (!trackExists) {
            if (note.pitch === 'Percussion') {
                if (!tracksToCreate.has('Percussion')) {
                    tracksToCreate.set('Percussion', new Set());
                }
                tracksToCreate.get('Percussion').add(note.instrumentName);
            } else {
                if (!tracksToCreate.has(note.pitch)) {
                    tracksToCreate.set(note.pitch, new Set());
                }
                tracksToCreate.get(note.pitch).add(note.instrumentName);
            }
        }
    });

    tracksToCreate.forEach((instruments, pitch) => {
        const parentTrack = document.querySelector(`.parent-track[data-pitch="${pitch}"]`);
        if (parentTrack) {
            instruments.forEach(instrumentName => {
                MusicMaker.addTrack(pitch, false, parentTrack, instrumentName, true);
            });
        }
    });

    MusicMaker.renderAllNotes();
    updateTimelineWidth();
    MusicMaker.updateCursorHeight();
    MusicMaker.updateCursor(0);
    
    document.getElementById('volume-slider').value = MusicMaker.state.volume;
    MusicMaker.Playback.setVolume(MusicMaker.state.volume);
}
