let songTotalTime = 0;
var MusicMaker = MusicMaker || {};

const UNDO_LIMIT = 20;
let undoStack = [];
let redoStack = [];

MusicMaker.createSnapshot = function() {
    const { layout, collapseState } = MusicMaker.getTrackLayout();
    return {
        tracks: JSON.parse(JSON.stringify(MusicMaker.notes)),
        songTotalTime: songTotalTime,
        trackLayout: layout,
        instruments: JSON.parse(JSON.stringify(MusicMaker.instruments)),
        collapseState: collapseState
    };
}

MusicMaker.commitChange = function(beforeState) {
    if (undoStack.length >= UNDO_LIMIT) {
        undoStack.shift(); // Remove the oldest state
    }
    undoStack.push(beforeState);
    redoStack = []; // Clear redo stack on new change
    const { layout, collapseState } = MusicMaker.getTrackLayout();
    MusicMaker.Storage.save(MusicMaker.notes, songTotalTime, layout, MusicMaker.instruments, collapseState);
}

MusicMaker.undo = function() {
    if (undoStack.length > 0) {
        const currentState = MusicMaker.createSnapshot();
        redoStack.push(currentState);

        const previousState = undoStack.pop();
        MusicMaker.applyState(previousState);
        const { layout, collapseState } = MusicMaker.getTrackLayout();
        MusicMaker.Storage.save(MusicMaker.notes, songTotalTime, layout, MusicMaker.instruments, collapseState);
    }
}

MusicMaker.redo = function() {
    if (redoStack.length > 0) {
        const currentState = MusicMaker.createSnapshot();
        undoStack.push(currentState);

        const nextState = redoStack.pop();
        MusicMaker.applyState(nextState);
        const { layout, collapseState } = MusicMaker.getTrackLayout();
        MusicMaker.Storage.save(MusicMaker.notes, songTotalTime, layout, MusicMaker.instruments, collapseState);
    }
}

MusicMaker.applyState = function(state) {
    MusicMaker.notes = state.tracks;
    songTotalTime = state.songTotalTime;
    MusicMaker.instruments = state.instruments;

    const trackLayout = state.trackLayout;
    const collapseState = state.collapseState;

    MusicMaker.createUI(trackLayout, collapseState);
    MusicMaker.populateInstrumentSelector();

    // Ensure all tracks for notes exist before rendering
    const tracksToCreate = new Map();
    MusicMaker.notes.forEach(note => {
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
        if (pitch === 'Percussion') {
            const parentTrack = document.querySelector(`.parent-track[data-pitch="Percussion"]`);
            if (parentTrack) {
                instruments.forEach(instrumentName => {
                    MusicMaker.addTrack('Percussion', 'medium', false, parentTrack, instrumentName, true);
                });
            }
        } else {
            const parentTrack = document.querySelector(`.parent-track[data-pitch="${pitch}"]`);
            if (parentTrack) {
                const size = parentTrack.dataset.size;
                instruments.forEach(instrumentName => {
                    MusicMaker.addTrack(pitch, size, false, parentTrack, instrumentName, true);
                });
            }
        }
    });

    MusicMaker.renderAllNotes();
    updateTimelineWidth();
    MusicMaker.setupEventListeners();
}


MusicMaker.findBestTempo = function(durations) {
    const epsilon = 0.02; // Using a slightly larger epsilon for checks
    const isMultiple = (num, base) => Math.abs(num - Math.round(num / base) * base) < epsilon;

    let has_thirds = false;
    let has_quarters = false;
    let has_halfs = false;

    for (const d of durations) {
        if (d <= 0) continue;

        const isQuarter = isMultiple(d, 0.25);
        const isHalf = isMultiple(d, 0.5);
        // Check for thirds, but exclude values that are also halves (like 1.5 which is 3/2 but also 4.5/3)
        const isThird = isMultiple(d * 3, 1) && !isHalf;
        const isInteger = isMultiple(d, 1);

        if (isThird) {
            has_thirds = true;
            break; // This is the most restrictive, so we can stop.
        }
        if (isQuarter && !isHalf) {
            has_quarters = true;
        }
        if (isHalf && !isInteger) {
            has_halfs = true;
        }
    }

    if (has_thirds) return 3;
    if (has_quarters) return 4;
    if (has_halfs) return 2;
    return 1;
}

MusicMaker.updateSongTotalTime = function() {
    let maxTime = 0;
    MusicMaker.notes.forEach(note => {
        const endTime = note.start + note.duration;
        if (endTime > maxTime) {
            maxTime = endTime;
        }
    });
    songTotalTime = maxTime;
}

MusicMaker.setupEventListeners = function() {
    const mainContent = document.getElementById('main-content');
    let isPanning = false;
    let startX, startY;
    let scrollLeft, scrollTop;
    let selectionBox = null;
    let selectionStartX, selectionStartY;

    mainContent.addEventListener('mousedown', (e) => {
        if (e.button === 2) { // Right-click for panning
            isPanning = true;
            startX = e.pageX - mainContent.offsetLeft;
            startY = e.pageY - mainContent.offsetTop;
            scrollLeft = mainContent.scrollLeft;
            scrollTop = mainContent.scrollTop;
            mainContent.style.cursor = 'grabbing';
            return;
        }

        if (e.button === 0 && !e.target.classList.contains('note') && e.target.id !== 'playback-cursor') { // Left-click on empty area
            if (e.target.closest('#track-headers-container')) {
                return;
            }
            // Check for double-click before initiating selection box.
            const now = Date.now();
            const lastClick = parseFloat(mainContent.dataset.lastClick) || 0;
            if (now - lastClick < 300) { // 300ms threshold for double-click
                mainContent.dataset.lastClick = 0; // Reset for next click
                return; // It's a double-click, so don't start selection.
            }
            mainContent.dataset.lastClick = now;


            // Clear previous selection if not holding shift
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

            const onMouseMove = (moveEvent) => {
                positionSelectionBox(moveEvent);
            };

            const onMouseUp = (upEvent) => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                selectNotesInBox(upEvent.shiftKey);
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

        const left = Math.min(x, startX);
        const top = Math.min(y, startY);
        const width = Math.abs(x - startX);
        const height = Math.abs(y - startY);

        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
    }

    function selectNotesInBox(shiftKey) {
        if (!selectionBox) return;
        const boxRect = selectionBox.getBoundingClientRect();
        const notes = document.querySelectorAll('.note');

        notes.forEach(note => {
            const noteRect = note.getBoundingClientRect();
            if (boxRect.left < noteRect.right && boxRect.right > noteRect.left &&
                boxRect.top < noteRect.bottom && boxRect.bottom > noteRect.top) {
                note.classList.add('selected');
            }
        });
    }

    mainContent.addEventListener('mouseleave', () => {
        isPanning = false;
        mainContent.style.cursor = 'default';
    });

    mainContent.addEventListener('mouseup', () => {
        isPanning = false;
        mainContent.style.cursor = 'default';
    });

    mainContent.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        const x = e.pageX - mainContent.offsetLeft;
        const y = e.pageY - mainContent.offsetTop;
        const walkX = (x - startX);
        const walkY = (y - startY);
        mainContent.scrollLeft = scrollLeft - walkX;
        mainContent.scrollTop = scrollTop - walkY;
    });

    mainContent.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const savedState = MusicMaker.Storage.load();
    let trackLayout = null;
    let collapseState = null;

    // Initialize instruments
    if (savedState && savedState.instruments) {
        MusicMaker.instruments = savedState.instruments;
    } else {
        MusicMaker.instruments = MusicMaker.instrumentData.instruments;
    }

    if (savedState && savedState.trackLayout) {
        trackLayout = savedState.trackLayout;
    }

    if (savedState && savedState.collapseState) {
        collapseState = savedState.collapseState;
    }

    MusicMaker.createUI(trackLayout, collapseState);
    MusicMaker.populateInstrumentSelector();
    MusicMaker.setupEventListeners();
    MusicMaker.setupCursorEventListeners();

    if (savedState) {
        MusicMaker.notes = savedState.tracks || [];
        songTotalTime = savedState.songTotalTime || 0;
        MusicMaker.renderAllNotes();
        updateTimelineWidth();

        // Restore collapse state
        const parentTracks = document.querySelectorAll('.parent-track');
        parentTracks.forEach(parent => {
            const pitch = parent.dataset.pitch;
            if (collapseState && collapseState[pitch]) {
                parent.classList.add('collapsed');
                const expandBtn = parent.querySelector('.expand-btn');
                if (expandBtn) {
                    expandBtn.innerHTML = '&#9654;';
                }
                let nextHeaderRow = parent.nextElementSibling;
                while (nextHeaderRow && nextHeaderRow.classList.contains('child-track') && nextHeaderRow.dataset.pitch === pitch) {
                    const timelineRow = document.querySelector(`#timeline-table tbody tr[data-pitch="${pitch}"][data-instrument="${nextHeaderRow.dataset.instrument}"]`);
                    nextHeaderRow.style.display = 'none';
                    if (timelineRow) timelineRow.style.display = 'none';
                    nextHeaderRow = nextHeaderRow.nextElementSibling;
                }
            } else {
                const expandBtn = parent.querySelector('.expand-btn');
                if (expandBtn) {
                    expandBtn.innerHTML = '&#9660;';
                }
            }
        });
    }
    
    // Initial state for undo
    undoStack.push(MusicMaker.createSnapshot());

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
        MusicMaker.exportTracks({ tracks: MusicMaker.notes, totalTime: songTotalTime });
    });
    
    document.getElementById('undoBtn').addEventListener('click', MusicMaker.undo);
    document.getElementById('redoBtn').addEventListener('click', MusicMaker.redo);

    const resetBtn = document.getElementById('resetBtn');
    const resetModal = document.getElementById('reset-modal');
    const confirmResetBtn = document.getElementById('confirmReset');
    const cancelResetBtn = document.getElementById('cancelReset');

    resetBtn.addEventListener('click', () => {
        resetModal.style.display = 'flex';
    });

    cancelResetBtn.addEventListener('click', () => {
        resetModal.style.display = 'none';
    });

    confirmResetBtn.addEventListener('click', () => {
        const beforeState = MusicMaker.createSnapshot();
        MusicMaker.Storage.clear();
        MusicMaker.notes = [];
        songTotalTime = 0;
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
        const selectedNotes = Array.from(document.querySelectorAll('.note.selected'));
        if (selectedNotes.length === 0) return;

        const tracksToChange = new Map();
        selectedNotes.forEach(noteElement => {
            const noteId = noteElement.dataset.noteId;
            const note = MusicMaker.notes.find(n => String(n.id) === noteId);
            if (note) {
                if (!tracksToChange.has(note.pitch)) {
                    tracksToChange.set(note.pitch, note.instrumentName);
                }
            }
        });

        tracksToChange.forEach((originalInstrument, pitch) => {
            if (originalInstrument !== instrumentName) {
                const existingTrack = document.querySelector(`tr[data-pitch="${pitch}"][data-instrument="${instrumentName}"]`);
                if (existingTrack) {
                    alert(`A track for instrument '${instrumentName}' already exists for pitch '${pitch}'. Please choose a different instrument.`);
                    instrumentSelector.value = originalInstrument;
                    return;
                }

                const notesOnTrack = MusicMaker.notes.filter(n => n.pitch === pitch && n.instrumentName === originalInstrument);
                const headerTrackElement = document.querySelector(`#track-headers-table tr[data-pitch="${pitch}"][data-instrument="${originalInstrument}"]`);
                const timelineTrackElement = document.querySelector(`#timeline-table tr[data-pitch="${pitch}"][data-instrument="${originalInstrument}"]`);

                if (headerTrackElement && timelineTrackElement) {
                    headerTrackElement.dataset.instrument = instrumentName;
                    timelineTrackElement.dataset.instrument = instrumentName;

                    const timeline = timelineTrackElement.querySelector('.timeline-col');
                    if (timeline) {
                        timeline.dataset.instrument = instrumentName;
                    }

                    notesOnTrack.forEach(n => n.instrumentName = instrumentName);

                    const noteElementsOnTrack = timelineTrackElement.querySelectorAll('.note');
                    noteElementsOnTrack.forEach(noteEl => {
                        const noteId = noteEl.dataset.noteId;
                        const noteData = MusicMaker.notes.find(n => String(n.id) === noteId);
                        if (noteData) {
                            MusicMaker.updateNoteAppearance(noteEl, noteData);
                        }
                    });
                }
            }
        });

        MusicMaker.commitChange(beforeState);
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
        const customDisplayNames = Object.keys(MusicMaker.instruments).map(name => name.toLowerCase());
        if (defaultDisplayNames.includes(lowerCaseDisplayName) || customDisplayNames.includes(lowerCaseDisplayName)) {
            alert('An instrument with this display name already exists.');
            return;
        }

        const lowerCaseExportName = exportName.toLowerCase();
        const defaultExportNames = ['d', 'g', 'w', 'n', 't', 'b', 'v', 'k', 'p', 'o'];
        const customExportNames = Object.values(MusicMaker.instruments)
            .filter(i => i.exportName)
            .map(i => i.exportName.toLowerCase());
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
            const selectedNotes = Array.from(document.querySelectorAll('.note.selected')).filter(n => {
                const rect = n.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
            if (selectedNotes.length === 0) return;

            const allTimelines = Array.from(document.querySelectorAll('.timeline-col')).filter(tl => {
                const rect = tl.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
            const selectedNoteData = [];

            for (const noteElement of selectedNotes) {
                const noteId = noteElement.dataset.noteId;
                const noteData = MusicMaker.notes.find(n => String(n.id) === noteId);
                if (noteData) {
                    const timeline = noteElement.closest('.timeline-col');
                    const trackIndex = allTimelines.indexOf(timeline);
                    // Only include notes that are on a currently visible timeline
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
                    size: note.size,
                    start: note.start - baseNote.start, // Relative horizontal start
                    duration: note.duration,
                    trackOffset: note.trackIndex - baseNote.trackIndex // Relative vertical position
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
});