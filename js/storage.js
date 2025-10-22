var MusicMaker = MusicMaker || {};

MusicMaker.Storage = (function() {

    const STORAGE_KEY = 'musicMakerState';

    function saveState(tracks, songTotalTime, trackLayout, instruments) {
        try {
            const state = {
                tracks: tracks,
                songTotalTime: songTotalTime,
                trackLayout: trackLayout,
                instruments: instruments
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error("Error saving state to localStorage", e);
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
            console.error("Error loading state from localStorage", e);
            return null;
        }
    }

    function clearState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error("Error clearing state from localStorage", e);
        }
    }

    return {
        save: saveState,
        load: loadState,
        clear: clearState
    };
})();
