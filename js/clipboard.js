var MusicMaker = MusicMaker || {};

MusicMaker.Clipboard = (function() {
    let copiedNotes = [];

    function setCopiedNotes(notes) {
        copiedNotes = notes;
    }

    function getCopiedNotes() {
        return copiedNotes;
    }

    return {
        set: setCopiedNotes,
        get: getCopiedNotes
    };
})();
