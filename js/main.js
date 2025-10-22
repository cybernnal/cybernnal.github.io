let tracks = [];
let songTotalTime = 0;
let stepWidth = 20; // 1 duration unit = 20 pixels
const TIME_UNIT_TO_MS = 100; // 1 duration unit = 100ms

document.addEventListener('DOMContentLoaded', () => {
    const savedState = MusicMaker.Storage.load();
    let trackLayout = null;
    if (savedState && savedState.trackLayout) {
        trackLayout = savedState.trackLayout;
    }

    MusicMaker.createUI(trackLayout);

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