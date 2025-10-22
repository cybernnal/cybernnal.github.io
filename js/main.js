let tracks = [];
let songTotalTime = 0;
let stepWidth = 20; // 1 duration unit = 20 pixels
const TIME_UNIT_TO_MS = 100; // 1 duration unit = 100ms

document.addEventListener('DOMContentLoaded', () => {
    const savedState = MusicMaker.Storage.load();
    let trackLayout = null;

    // Initialize instruments
    if (savedState && savedState.instruments) {
        MusicMaker.instruments = savedState.instruments;
    } else {
        MusicMaker.instruments = MusicMaker.instrumentData.instruments;
    }

    if (savedState && savedState.trackLayout) {
        trackLayout = savedState.trackLayout;
    }

    MusicMaker.createUI(trackLayout);
    MusicMaker.populateInstrumentSelector();

    if (savedState) {
        tracks = savedState.tracks || [];
        songTotalTime = savedState.songTotalTime || 0;
        MusicMaker.renderAllNotes();
    }

    document.getElementById('importBtn').addEventListener('click', MusicMaker.importTracks);
    document.getElementById('exportBtn').addEventListener('click', () => {
        MusicMaker.exportTracks({ tracks: tracks, totalTime: songTotalTime });
    });

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
        MusicMaker.Storage.clear();
        tracks = [];
        songTotalTime = 0;
        location.reload();
    });

    const appContainer = document.getElementById('app-container');
    let isPanning = false;
    let startX, startY;
    let scrollLeft, scrollTop;
    let selectionBox = null;
    let selectionStartX, selectionStartY;

    appContainer.addEventListener('mousedown', (e) => {
        if (e.button === 2) { // Right-click for panning
            isPanning = true;
            startX = e.pageX - appContainer.offsetLeft;
            startY = e.pageY - appContainer.offsetTop;
            scrollLeft = appContainer.scrollLeft;
            scrollTop = appContainer.scrollTop;
            appContainer.style.cursor = 'grabbing';
            return;
        }

        if (e.button === 0 && !e.target.classList.contains('note')) { // Left-click on empty area
            if (e.target.closest('.track-header')) {
                return;
            }
            // Check for double-click before initiating selection box.
            const now = Date.now();
            const lastClick = parseFloat(appContainer.dataset.lastClick) || 0;
            if (now - lastClick < 300) { // 300ms threshold for double-click
                appContainer.dataset.lastClick = 0; // Reset for next click
                return; // It's a double-click, so don't start selection.
            }
            appContainer.dataset.lastClick = now;


            // Clear previous selection if not holding shift
            if (!e.shiftKey) {
                document.querySelectorAll('.note.selected').forEach(n => n.classList.remove('selected'));
                MusicMaker.updateSelectorToSelection();
            }

            selectionStartX = e.clientX;
            selectionStartY = e.clientY;

            selectionBox = document.createElement('div');
            selectionBox.id = 'selection-box';
            appContainer.appendChild(selectionBox);

            positionSelectionBox(e);

            const onMouseMove = (moveEvent) => {
                positionSelectionBox(moveEvent);
            };

            const onMouseUp = (upEvent) => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                selectNotesInBox(upEvent.shiftKey);
                if (selectionBox) {
                    appContainer.removeChild(selectionBox);
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
        const rect = appContainer.getBoundingClientRect();
        const x = e.clientX - rect.left + appContainer.scrollLeft;
        const y = e.clientY - rect.top + appContainer.scrollTop;
        const startX = selectionStartX - rect.left + appContainer.scrollLeft;
        const startY = selectionStartY - rect.top + appContainer.scrollTop;

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

    appContainer.addEventListener('mouseleave', () => {
        isPanning = false;
        appContainer.style.cursor = 'default';
    });

    appContainer.addEventListener('mouseup', () => {
        isPanning = false;
        appContainer.style.cursor = 'default';
    });

    appContainer.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        const x = e.pageX - appContainer.offsetLeft;
        const y = e.pageY - appContainer.offsetTop;
        const walkX = (x - startX);
        const walkY = (y - startY);
        appContainer.scrollLeft = scrollLeft - walkX;
        appContainer.scrollTop = scrollTop - walkY;
    });

    appContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    document.getElementById('instrument-selector').addEventListener('change', (e) => {
        const selectedInstrument = e.target.value;
        if (!selectedInstrument) return;

        const selectedNotes = Array.from(document.querySelectorAll('.note.selected'));
        if (selectedNotes.length === 0) return;

        let instrumentName = selectedInstrument;

        if (selectedInstrument === 'custom') {
            // Generate a unique custom instrument name
            let customInstrumentIndex = 1;
            while (MusicMaker.instruments[`custom${customInstrumentIndex}`]) {
                customInstrumentIndex++;
            }
            instrumentName = `custom${customInstrumentIndex}`;

            // Generate a random hue that is not already in use
            const usedHues = Object.values(MusicMaker.instruments).map(inst => inst.hue);
            let randomHue;
            do {
                randomHue = Math.floor(Math.random() * 360);
            } while (usedHues.includes(randomHue));

            MusicMaker.instruments[instrumentName] = {
                sizes: ["tiny", "small", "medium", "large", "huge"],
                hue: randomHue,
                saturation: 70
            };

            // Add the new custom instrument to the dropdown
            const selector = document.getElementById('instrument-selector');
            const option = document.createElement('option');
            option.value = instrumentName;
            option.textContent = instrumentName.charAt(0).toUpperCase() + instrumentName.slice(1);
            selector.insertBefore(option, selector.lastChild);
            selector.value = instrumentName;
        }

        const tracksToChange = new Map();
        selectedNotes.forEach(noteElement => {
            const noteId = noteElement.dataset.noteId;
            const note = tracks.find(n => String(n.id) === noteId);
            if (note) {
                if (!tracksToChange.has(note.pitch)) {
                    tracksToChange.set(note.pitch, note.instrumentName);
                }
            }
        });

        tracksToChange.forEach((originalInstrument, pitch) => {
            if (originalInstrument !== instrumentName) {
                // Find all notes on this pitch with the original instrument
                const notesOnTrack = tracks.filter(n => n.pitch === pitch && n.instrumentName === originalInstrument);
                
                // Update the track element itself
                const trackElement = document.querySelector(`.track[data-pitch="${pitch}"][data-instrument="${originalInstrument}"]`);
                if (trackElement) {
                    trackElement.dataset.instrument = instrumentName;
                    const timeline = trackElement.querySelector('.timeline');
                    if (timeline) {
                        timeline.dataset.instrument = instrumentName;
                    }

                    // Update the data objects
                    notesOnTrack.forEach(n => n.instrumentName = instrumentName);

                    // Update the appearance of the note elements on the DOM
                    const noteElementsOnTrack = trackElement.querySelectorAll('.note');
                    noteElementsOnTrack.forEach(noteEl => {
                        const noteId = noteEl.dataset.noteId;
                        const noteData = tracks.find(n => String(n.id) === noteId);
                        if (noteData) {
                            MusicMaker.updateNoteAppearance(noteEl, noteData);
                        }
                    });
                }
            }
        });

        MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout(), MusicMaker.instruments);
    });

    document.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const copyKeyPressed = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'c';
        const pasteKeyPressed = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'v';

        if (copyKeyPressed) {
            const selectedNotes = Array.from(document.querySelectorAll('.note.selected')).filter(n => {
                const rect = n.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
            if (selectedNotes.length === 0) return;

            const allTimelines = Array.from(document.querySelectorAll('.timeline')).filter(tl => {
                const rect = tl.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
            const selectedNoteData = [];

            for (const noteElement of selectedNotes) {
                const noteId = noteElement.dataset.noteId;
                const noteData = tracks.find(n => String(n.id) === noteId);
                if (noteData) {
                    const timeline = noteElement.closest('.timeline');
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
                MusicMaker.startPasting(notesToPaste);
            }
        }
    });
});