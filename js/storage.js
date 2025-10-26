var MusicMaker = MusicMaker || {};

MusicMaker.Storage = (function() {

    const STORAGE_KEY = 'musicMakerState';

    function saveState(tracks, songTotalTime, trackLayout, instruments, collapseState, volume) {
        try {
            const state = {
                tracks: tracks,
                songTotalTime: songTotalTime,
                trackLayout: trackLayout,
                instruments: instruments,
                collapseState: collapseState,
                volume: volume
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
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
