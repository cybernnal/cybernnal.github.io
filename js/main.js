var MusicMaker = MusicMaker || {};

MusicMaker.findBestTempo = function(durations) {
    const epsilon = 0.02;
    const isMultiple = (num, base) => Math.abs(num - Math.round(num / base) * base) < epsilon;
    let has_thirds = false, has_quarters = false, has_halfs = false;
    for (const d of durations) {
        if (d <= 0) continue;
        const isQuarter = isMultiple(d, 0.25);
        const isHalf = isMultiple(d, 0.5);
        const isThird = isMultiple(d * 3, 1) && !isHalf;
        if (isThird) { has_thirds = true; break; }
        if (isQuarter && !isHalf) has_quarters = true;
        if (isHalf && !isMultiple(d, 1)) has_halfs = true;
    }
    if (has_thirds) return 3;
    if (has_quarters) return 4;
    if (has_halfs) return 2;
    return 1;
}

MusicMaker.updateSongTotalTime = function() {
    let maxTime = 0;
    MusicMaker.state.tracks.forEach(note => {
        const endTime = note.start + note.duration;
        if (endTime > maxTime) maxTime = endTime;
    });
    MusicMaker.state.songTotalTime = maxTime;
}

MusicMaker.updateCursorHeight = function() {
    const timelineTable = document.getElementById('timeline-table');
    const cursor = document.getElementById('playback-cursor');
    if (timelineTable && cursor) {
        cursor.style.height = timelineTable.scrollHeight + 'px';
    }
};

MusicMaker.createCustomInstrument = function(displayName, exportName) {
    if (!MusicMaker.state.instruments[displayName]) {
        MusicMaker.state.instruments[displayName] = {
            exportName: exportName,
            isCustom: true
        };
        MusicMaker.populateInstrumentSelector();
        MusicMaker.Storage.save(MusicMaker.state);
    }
};

MusicMaker.setupEventListeners = function() {
    const mainContent = document.getElementById('main-content');
    let isPanning = false, startX, startY, scrollLeft, scrollTop;
    let selectionBox = null, selectionStartX, selectionStartY;

    mainContent.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            isPanning = true;
            startX = e.pageX - mainContent.offsetLeft;
            startY = e.pageY - mainContent.offsetTop;
            scrollLeft = mainContent.scrollLeft;
            scrollTop = mainContent.scrollTop;
            mainContent.style.cursor = 'grabbing';
            return;
        }

        if (e.button === 0 && !e.target.classList.contains('note') && e.target.id !== 'playback-cursor') {
            if (e.target.closest('#track-headers-container')) return;
            const now = Date.now();
            if (now - (parseFloat(mainContent.dataset.lastClick) || 0) < 300) {
                mainContent.dataset.lastClick = 0;
                return;
            }
            mainContent.dataset.lastClick = now;

            if (!e.shiftKey) {
                document.querySelectorAll('.note.selected').forEach(n => n.classList.remove('selected'));
                MusicMaker.updateSelectorToSelection();
            }

            selectionStartX = e.clientX;
            selectionStartY = e.clientY;
            selectionBox = document.createElement('div');
            selectionBox.id = 'selection-box';
            mainContent.appendChild(selectionBox);
            positionSelectionBox(e);

            const onMouseMove = (moveEvent) => positionSelectionBox(moveEvent);
            const onMouseUp = (upEvent) => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                selectNotesInBox();
                if (selectionBox) {
                    mainContent.removeChild(selectionBox);
                    selectionBox = null;
                }
                MusicMaker.updateSelectorToSelection();
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    });

    function positionSelectionBox(e) {
        if (!selectionBox) return;
        const rect = mainContent.getBoundingClientRect();
        const x = e.clientX - rect.left + mainContent.scrollLeft;
        const y = e.clientY - rect.top + mainContent.scrollTop;
        const startX = selectionStartX - rect.left + mainContent.scrollLeft;
        const startY = selectionStartY - rect.top + mainContent.scrollTop;
        selectionBox.style.left = Math.min(x, startX) + 'px';
        selectionBox.style.top = Math.min(y, startY) + 'px';
        selectionBox.style.width = Math.abs(x - startX) + 'px';
        selectionBox.style.height = Math.abs(y - startY) + 'px';
    }

    function selectNotesInBox() {
        if (!selectionBox) return;

        const boxRect = selectionBox.getBoundingClientRect();

        document.querySelectorAll('.note').forEach(note => {
            const noteRect = note.getBoundingClientRect();

            if (
                boxRect.left < noteRect.right &&
                boxRect.right > noteRect.left &&
                boxRect.top < noteRect.bottom &&
                boxRect.bottom > noteRect.top
            ) {
                note.classList.add('selected');
            }
        });
    }

    mainContent.addEventListener('mouseleave', () => { isPanning = false; mainContent.style.cursor = 'default'; });
    mainContent.addEventListener('mouseup', () => { isPanning = false; mainContent.style.cursor = 'default'; });
    mainContent.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        const x = e.pageX - mainContent.offsetLeft, y = e.pageY - mainContent.offsetTop;
        mainContent.scrollLeft = scrollLeft - (x - startX);
        mainContent.scrollTop = scrollTop - (y - startY);
    });
    mainContent.addEventListener('scroll', MusicMaker.updateCursorHeight);
    mainContent.addEventListener('contextmenu', (e) => e.preventDefault());
}

document.addEventListener('DOMContentLoaded', () => {
    const savedState = MusicMaker.Storage.load();
    if (savedState) {
        Object.assign(MusicMaker.state, savedState);
    } else {
        MusicMaker.state.instruments = MusicMaker.instrumentData.instruments;
    }

    const trackLayout = MusicMaker.state.trackLayout;
    const trackPitches = trackLayout ? MusicMaker.ALL_PITCH_NAMES.filter(pitch => trackLayout.hasOwnProperty(pitch)) : null;
    MusicMaker.createUI(trackPitches, trackLayout, MusicMaker.state.collapseState);
    
    MusicMaker.populateInstrumentSelector();
    MusicMaker.setupEventListeners();
    MusicMaker.setupCursorEventListeners();
    MusicMaker.renderAllNotes();
    updateTimelineWidth();

    const volumeSlider = document.getElementById('volume-slider');
    volumeSlider.value = MusicMaker.state.volume;
    MusicMaker.Playback.setVolume(MusicMaker.state.volume);

    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value;
        MusicMaker.Playback.setVolume(volume);
        MusicMaker.state.volume = volume;
        MusicMaker.Storage.save(MusicMaker.state);
    });

    MusicMaker.state.undoStack.push(MusicMaker.createSnapshot());

    document.getElementById('zoom-slider').value = stepWidth;

    document.getElementById('importBtn').addEventListener('click', () => {
        const beforeState = MusicMaker.createSnapshot();
        MusicMaker.importTracks(beforeState);
    });
    document.getElementById('importMidiBtn').addEventListener('click', () => {
        const beforeState = MusicMaker.createSnapshot();
        MusicMaker.MidiImport.importMidi(beforeState);
    });
    document.getElementById('exportBtn').addEventListener('click', () => {
        MusicMaker.exportTracks({ tracks: MusicMaker.state.tracks, totalTime: MusicMaker.state.songTotalTime });
    });
    
    document.getElementById('undoBtn').addEventListener('click', MusicMaker.undo);
    document.getElementById('redoBtn').addEventListener('click', MusicMaker.redo);

    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (MusicMaker.Playback.isPlaying) {
                MusicMaker.Playback.pause();
                playBtn.textContent = 'Play';
            } else {
                MusicMaker.Playback.play();
                playBtn.textContent = 'Pause';
            }
        });
    }

    const rewindBtn = document.getElementById('rewindBtn');
    if (rewindBtn) {
        rewindBtn.addEventListener('click', () => MusicMaker.Playback.seek(0));
    }

    const resetBtn = document.getElementById('resetBtn');
    const resetModal = document.getElementById('reset-modal');
    const confirmResetBtn = document.getElementById('confirmReset');
    const cancelResetBtn = document.getElementById('cancelReset');

    resetBtn.addEventListener('click', () => resetModal.style.display = 'flex');
    cancelResetBtn.addEventListener('click', () => resetModal.style.display = 'none');
    confirmResetBtn.addEventListener('click', () => {
        const beforeState = MusicMaker.createSnapshot();
        MusicMaker.Storage.clear();
        MusicMaker.state.tracks = [];
        MusicMaker.state.songTotalTime = 0;
        MusicMaker.state.trackLayout = null;
        MusicMaker.state.collapseState = {};
        MusicMaker.createUI();
        MusicMaker.populateInstrumentSelector();
        updateTimelineWidth();
        MusicMaker.setupEventListeners();
        MusicMaker.updateCursorHeight();
        MusicMaker.updateCursor(0);
        MusicMaker.commitChange(beforeState);
        resetModal.style.display = 'none';
    });

    const instrumentSelector = document.getElementById('instrument-selector');
    const customInstrumentModal = document.getElementById('custom-instrument-modal');
    const customInstrumentDisplayNameInput = document.getElementById('custom-instrument-display-name');
    const customInstrumentExportNameInput = document.getElementById('custom-instrument-export-name');
    const saveCustomInstrumentBtn = document.getElementById('save-custom-instrument');
    const cancelCustomInstrumentBtn = document.getElementById('cancel-custom-instrument');

    function applyInstrumentChange(instrumentName) {
        const beforeState = MusicMaker.createSnapshot();
        const selectedNoteElements = document.querySelectorAll('.note.selected');
        if (selectedNoteElements.length === 0) return;

        const selectedNotesData = Array.from(selectedNoteElements)
            .map(el => MusicMaker.state.tracks.find(n => String(n.id) === el.dataset.noteId))
            .filter(Boolean);

        const noteIdsToReselect = new Set(selectedNotesData.map(n => n.id));

        const tracksToChange = new Map();
        selectedNotesData.forEach(note => {
            const trackId = `${note.pitch}|${note.instrumentName}`;
            if (!tracksToChange.has(trackId)) {
                tracksToChange.set(trackId, { pitch: note.pitch, instrumentName: note.instrumentName });
            }
        });

        const targets = new Set();
        for (const [trackId, trackInfo] of tracksToChange) {
            const { pitch, instrumentName: originalInstrument } = trackInfo;
            if (originalInstrument === instrumentName) continue;

            const targetId = `${pitch}|${instrumentName}`;
            if (targets.has(targetId)) {
                alert(`Cannot change multiple tracks for pitch '${pitch}' to the same instrument '${instrumentName}' in one operation.`);
                return;
            }
            targets.add(targetId);

            let existingTrack = null;
            for (const row of document.querySelectorAll('#track-headers-table tr')) {
                if (row.dataset.pitch === pitch && row.dataset.instrument === instrumentName) {
                    existingTrack = row;
                    break;
                }
            }

            if (existingTrack) {
                const isPartOfChange = Array.from(tracksToChange.values()).some(t => t.pitch === pitch && t.instrumentName === instrumentName);
                if (!isPartOfChange) {
                    alert(`A track for instrument '${instrumentName}' already exists for pitch '${pitch}'. Cannot change track.`);
                    document.getElementById('instrument-selector').value = originalInstrument;
                    return;
                }
            }

            const allNotesOnTrack = MusicMaker.state.tracks.filter(n => n.pitch === pitch && n.instrumentName === originalInstrument);
            for (const note of allNotesOnTrack) {
                const midi = MusicMaker.noteNameToMidi(note.pitch);
                const instrumentData = MusicMaker.instrumentData.instruments[instrumentName];
                if (instrumentData && (midi < instrumentData.noteRange[0] || midi > instrumentData.noteRange[1])) {
                    alert(`Cannot change track to "${instrumentName}" because it cannot play the note "${note.pitch}".`);
                    document.getElementById('instrument-selector').value = originalInstrument;
                    return;
                }
            }
        }

        const updates = [];
        tracksToChange.forEach((trackInfo) => {
            const { pitch, instrumentName: originalInstrument } = trackInfo;
            if (originalInstrument === instrumentName) return;

            const trackObject = MusicMaker.tracks.find(t => t.pitch === pitch && t.instrumentName === originalInstrument);
            const headerTrackElement = document.querySelector(`#track-headers-table tr[data-pitch="${pitch}"][data-instrument="${originalInstrument}"]`);
            const timelineTrackElement = document.querySelector(`#timeline-table tr[data-pitch="${pitch}"][data-instrument="${originalInstrument}"]`);

            updates.push({ pitch, originalInstrument, trackObject, headerTrackElement, timelineTrackElement });
        });

        updates.forEach(({ pitch, originalInstrument }) => {
            MusicMaker.state.tracks.forEach(note => {
                if (note.pitch === pitch && note.instrumentName === originalInstrument) {
                    note.instrumentName = instrumentName;
                }
            });
        });

        updates.forEach(({ trackObject }) => {
            if (trackObject) {
                trackObject.instrumentName = instrumentName;
            }
        });

        updates.forEach(({ headerTrackElement, timelineTrackElement }) => {
            if (headerTrackElement) headerTrackElement.dataset.instrument = instrumentName;
            if (timelineTrackElement) {
                timelineTrackElement.dataset.instrument = instrumentName;
                const timeline = timelineTrackElement.querySelector('.timeline-col');
                if (timeline) timeline.dataset.instrument = instrumentName;
            }
        });

        MusicMaker.renderAllNotes();

        noteIdsToReselect.forEach(id => {
            const noteElement = document.querySelector(`.note[data-note-id="${id}"]`);
            if (noteElement) {
                noteElement.classList.add('selected');
            }
        });

        MusicMaker.commitChange(beforeState);
        MusicMaker.updateSelectorToSelection();
    }

    instrumentSelector.addEventListener('change', (e) => {
        const selectedInstrument = e.target.value;
        if (!selectedInstrument) return;
        const selectedNotes = Array.from(document.querySelectorAll('.note.selected'));
        if (selectedNotes.length === 0) {
            instrumentSelector.value = '';
            return;
        }
        if (selectedInstrument === 'custom') {
            customInstrumentModal.style.display = 'flex';
            customInstrumentDisplayNameInput.focus();
        } else {
            applyInstrumentChange(selectedInstrument);
        }
    });

    saveCustomInstrumentBtn.addEventListener('click', () => {
        const displayName = customInstrumentDisplayNameInput.value.trim();
        const exportName = customInstrumentExportNameInput.value.trim();
        if (!displayName || !exportName) {
            alert('Please enter both a display name and an export name.');
            return;
        }
        const lowerCaseDisplayName = displayName.toLowerCase();
        const defaultDisplayNames = Object.keys(MusicMaker.instrumentData.instruments).map(name => name.toLowerCase());
        const customDisplayNames = Object.keys(MusicMaker.state.instruments).map(name => name.toLowerCase());
        if (defaultDisplayNames.includes(lowerCaseDisplayName) || customDisplayNames.includes(lowerCaseDisplayName)) {
            alert('An instrument with this display name already exists.');
            return;
        }
        const lowerCaseExportName = exportName.toLowerCase();
        const defaultExportNames = ['d', 'g', 'w', 'n', 't', 'b', 'v', 'k', 'p', 'o'];
        const customExportNames = Object.values(MusicMaker.state.instruments).filter(i => i.exportName).map(i => i.exportName.toLowerCase());
        if (defaultExportNames.includes(lowerCaseExportName) || customExportNames.includes(lowerCaseExportName)) {
            alert('This export name is already in use.');
            return;
        }
        MusicMaker.createCustomInstrument(displayName, exportName);
        instrumentSelector.value = displayName;
        applyInstrumentChange(displayName);
        customInstrumentDisplayNameInput.value = '';
        customInstrumentExportNameInput.value = '';
        customInstrumentModal.style.display = 'none';
    });

    cancelCustomInstrumentBtn.addEventListener('click', () => {
        customInstrumentDisplayNameInput.value = '';
        customInstrumentExportNameInput.value = '';
        customInstrumentModal.style.display = 'none';
        instrumentSelector.value = '';
    });

    document.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const copyKeyPressed = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'c';
        const pasteKeyPressed = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'v';
        const undoKeyPressed = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'z';
        const redoKeyPressed = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'y';

        if (copyKeyPressed) {
            const selectedNotes = Array.from(document.querySelectorAll('.note.selected')).filter(n => n.getBoundingClientRect().width > 0 && n.getBoundingClientRect().height > 0);
            if (selectedNotes.length === 0) return;
            const allTimelines = Array.from(document.querySelectorAll('.timeline-col')).filter(tl => tl.offsetParent !== null);
            const selectedNoteData = [];
            for (const noteElement of selectedNotes) {
                const noteId = noteElement.dataset.noteId;
                const noteData = MusicMaker.state.tracks.find(n => String(n.id) === noteId);
                if (noteData) {
                    const timeline = noteElement.closest('.timeline-col');
                    const trackIndex = allTimelines.indexOf(timeline);
                    if (trackIndex > -1) {
                        selectedNoteData.push({ ...noteData, trackIndex });
                    }
                }
            }
            if (selectedNoteData.length > 0) {
                selectedNoteData.sort((a, b) => a.trackIndex - b.trackIndex || a.start - b.start);
                const baseNote = selectedNoteData[0];
                const clipboardData = selectedNoteData.map(note => ({
                    instrumentName: note.instrumentName,
                    start: note.start - baseNote.start,
                    duration: note.duration,
                    trackOffset: note.trackIndex - baseNote.trackIndex
                }));
                MusicMaker.Clipboard.set(clipboardData);
            }
        } else if (pasteKeyPressed) {
            const notesToPaste = MusicMaker.Clipboard.get();
            if (notesToPaste.length > 0) {
                const beforeState = MusicMaker.createSnapshot();
                MusicMaker.startPasting(notesToPaste, beforeState);
            }
        } else if (undoKeyPressed) {
            e.preventDefault();
            MusicMaker.undo();
        } else if (redoKeyPressed) {
            e.preventDefault();
            MusicMaker.redo();
        }
    });
    MusicMaker.updateCursor(0);
    MusicMaker.updateCursorHeight();
});
