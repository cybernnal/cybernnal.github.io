var MusicMaker = MusicMaker || {};

MusicMaker.Storage = (function() {

    const STORAGE_KEY = 'musicMakerState';

    function saveState(state) {
        try {
            // Create a serializable version of the state
            const stateToSave = {
                tracks: state.tracks,
                songTotalTime: state.songTotalTime,
                trackLayout: state.trackLayout,
                instruments: state.instruments,
                collapseState: state.collapseState,
                volume: state.volume
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Error saving state to localStorage:", e);
        }
    }

    function loadState() {
        try {
            const savedState = localStorage.getItem(STORAGE_KEY);
            if (savedState === null) {
                return null;
            }
            return JSON.parse(savedState);
        } catch (e) {
            return null;
        }
    }

    function clearState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
        }
    }

    return {
        save: saveState,
        load: loadState,
        clear: clearState
    };
})();
