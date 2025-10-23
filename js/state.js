var MusicMaker = MusicMaker || {};

MusicMaker.state = {
    tracks: [],
    songTotalTime: 0,
    instruments: {},
    trackLayout: null,
    undoStack: [],
    redoStack: [],
    UNDO_LIMIT: 20
};

MusicMaker.createSnapshot = function() {
    return {
        tracks: JSON.parse(JSON.stringify(MusicMaker.state.tracks)),
        songTotalTime: MusicMaker.state.songTotalTime,
        trackLayout: MusicMaker.getTrackLayout(),
        instruments: JSON.parse(JSON.stringify(MusicMaker.state.instruments))
    };
}

MusicMaker.commitChange = function(beforeState) {
    if (MusicMaker.state.undoStack.length >= MusicMaker.state.UNDO_LIMIT) {
        MusicMaker.state.undoStack.shift(); // Remove the oldest state
    }
    MusicMaker.state.undoStack.push(beforeState);
    MusicMaker.state.redoStack = []; // Clear redo stack on new change
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
    MusicMaker.state.tracks = state.tracks;
    MusicMaker.state.songTotalTime = state.songTotalTime;
    MusicMaker.state.instruments = state.instruments;

    MusicMaker.createUI(state.trackLayout);
    MusicMaker.populateInstrumentSelector();
    MusicMaker.renderAllNotes();
    updateTimelineWidth();
}