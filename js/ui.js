var MusicMaker = MusicMaker || {};

// The 13 pitches that make up a single user-defined "octave"
const OCTAVE_PITCH_NAMES = ['F#', 'F', 'E', 'D#', 'D', 'C#', 'C', 'B', 'A#', 'A', 'G#', 'G', 'LF#'];
const SIZES = ['tiny', 'small', 'medium', 'large', 'huge'];

// Base Hues (0-360) for each instrument
const INSTRUMENT_HUES = {
    'diapason': 210, // blue
    'gamba': 140,    // green
    'steam whistle': 30, // orange
    'nasard': 280,   // purple
    'trompette': 0,      // red
    'subbass': 170,    // teal
    'vox humana': 330,   // pink
    'gedeckt': 50,     // yellow
    'posaune': 30,     // brown (orange hue, lower saturation)
    'piccolo': 190     // cyan
};

MusicMaker.createUI = function() {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = ''; // Clear previous UI

    // Loop through each size to create 5 distinct blocks
    SIZES.forEach((size, index) => {
        const octaveNum = 5 - index; // 5 for tiny, 4 for small, etc.

        // Create the rows for this octave block
        OCTAVE_PITCH_NAMES.forEach(pitchName => {
            const fullPitchName = pitchName + octaveNum;
            const track = document.createElement('div');
            track.className = 'track';
            track.dataset.pitch = fullPitchName;

            const trackHeader = document.createElement('div');
            trackHeader.className = 'track-header';

            const key = document.createElement('div');
            const isBlackKey = pitchName.includes('#');
            key.className = isBlackKey ? 'key key--black' : 'key key--white';
            key.textContent = fullPitchName;

            trackHeader.appendChild(key);

            const timeline = document.createElement('div');
            timeline.className = 'timeline';

            timeline.addEventListener('dblclick', (e) => {
                if (e.button !== 0) return; // only left-click
                const newNote = {
                    id: Date.now() + Math.random(),
                    instrumentName: 'diapason', // default
                    size: size,
                    pitch: fullPitchName,
                    start: e.offsetX / stepWidth, // Convert pixel offset to time unit
                    duration: 0.5 // New default duration
                };
                tracks.push(newNote);
                MusicMaker.renderNote(newNote);
            });

            track.appendChild(trackHeader);
            track.appendChild(timeline);
            appContainer.appendChild(track);
        });

        // Add a separator after each block, except the last one
        if (index < SIZES.length - 1) {
            const separator = document.createElement('div');
            separator.className = 'octave-separator';
            appContainer.appendChild(separator);
        }
    });
};

MusicMaker.renderNote = function(note) {
    const timeline = document.querySelector(`.track[data-pitch="${note.pitch}"] .timeline`);
    if (!timeline) return;

    const noteElement = document.createElement('div');
    noteElement.className = 'note';
    noteElement.textContent = `${note.instrumentName[0]}${note.size[0]}`;

    // --- Color Calculation Logic ---
    const hue = INSTRUMENT_HUES[note.instrumentName] || 200; // Default to a neutral blue
    const pitchIndex = OCTAVE_PITCH_NAMES.indexOf(note.pitch.slice(0, -1));
    const lightness = 85 - (pitchIndex * 3.5);
    const saturation = (note.instrumentName === 'posaune') ? 40 : 70; // Lower saturation for Posaune

    noteElement.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    noteElement.style.borderColor = `hsl(${hue}, ${saturation}%, ${lightness - 20}%)`; // Darker border
    // --- End of Color Logic ---

    noteElement.style.left = (note.start * stepWidth) + 'px';
    noteElement.style.width = (note.duration * stepWidth) + 'px';
    noteElement.dataset.noteId = note.id;

    noteElement.dataset.lastRightClick = 0;
    noteElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const now = Date.now();
        const lastRightClick = parseFloat(noteElement.dataset.lastRightClick) || 0;

        if (now - lastRightClick < 300) { // 300ms threshold for double-click
            const noteId = e.target.dataset.noteId;
            // Find the note in the tracks array and remove it
            const noteIndex = tracks.findIndex(n => n.id == noteId);
            if (noteIndex > -1) {
                tracks.splice(noteIndex, 1);
            }
            // Remove the element from the DOM
            e.target.remove();
        }
        noteElement.dataset.lastRightClick = now;
    });

    noteElement.addEventListener('mousemove', (e) => {
        const rect = noteElement.getBoundingClientRect();
        const resizeHandleWidth = 5; // 5px handle

        if (e.clientX > rect.right - resizeHandleWidth) {
            noteElement.style.cursor = 'e-resize';
        } else if (e.clientX < rect.left + resizeHandleWidth) {
            noteElement.style.cursor = 'w-resize';
        } else {
            noteElement.style.cursor = 'move';
        }
    });

    noteElement.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;

        // --- Selection Logic ---
        if (e.shiftKey) {
            noteElement.classList.toggle('selected');
        } else {
            if (!noteElement.classList.contains('selected')) {
                document.querySelectorAll('.note.selected').forEach(n => n.classList.remove('selected'));
                noteElement.classList.add('selected');
            }
        }
        // --- End Selection Logic ---

        const initialX = e.pageX;
        const isResizing = noteElement.style.cursor === 'e-resize' || noteElement.style.cursor === 'w-resize';

        if (noteElement.classList.contains('selected') && !isResizing) {
            // Dragging multiple notes
            const selectedNotes = Array.from(document.querySelectorAll('.note.selected'));
            const initialPositions = selectedNotes.map(n => ({ el: n, left: n.offsetLeft, note: tracks.find(nt => nt.id == n.dataset.noteId) }));

            function onMouseMove(moveEvent) {
                const dx = moveEvent.pageX - initialX;
                let bestDx = dx;
                let moveNotes = true;

                // Check if the current dx is valid
                let collision = false;
                for (const pos of initialPositions) {
                    const newLeft = pos.left + dx;
                    if (newLeft < 0) {
                        collision = true;
                        break;
                    }
                    const noteWidth = pos.el.offsetWidth;
                    const timeline = pos.el.parentElement;
                    const staticNotes = Array.from(timeline.children).filter(child => !child.classList.contains('selected'));
                    for (const staticNote of staticNotes) {
                        const staticLeft = staticNote.offsetLeft;
                        const staticWidth = staticNote.offsetWidth;
                        if (newLeft < staticLeft + staticWidth && newLeft + noteWidth > staticLeft) {
                            collision = true;
                            break;
                        }
                    }
                    if (collision) break;
                }

                if (collision) {
                    // The desired position is not valid. Find the best valid one.
                    const snapCandidates = [];

                    // Add the "before" and "after" snap points for each colliding note
                    for (const pos of initialPositions) {
                        const newLeft = pos.left + dx;
                        if (newLeft < 0) {
                            snapCandidates.push(-pos.left);
                        }
                        const noteWidth = pos.el.offsetWidth;
                        const timeline = pos.el.parentElement;
                        const staticNotes = Array.from(timeline.children).filter(child => !child.classList.contains('selected'));
                        for (const staticNote of staticNotes) {
                            const staticLeft = staticNote.offsetLeft;
                            const staticWidth = staticNote.offsetWidth;
                            if (newLeft < staticLeft + staticWidth && newLeft + noteWidth > staticLeft) {
                                // Collision detected for this note. Add snap candidates.
                                const snapDx1 = (staticLeft - noteWidth) - pos.left;
                                const snapDx2 = (staticLeft + staticWidth) - pos.left;
                                snapCandidates.push(snapDx1);
                                snapCandidates.push(snapDx2);
                            }
                        }
                    }

                    let minDistance = Infinity;
                    let foundSnap = false;

                    for (const snapDx of snapCandidates) {
                        let isSnapDxValid = true;
                        // Check if this snapDx is valid for the whole block
                        for (const pos of initialPositions) {
                            const newLeft = pos.left + snapDx;
                            if (newLeft < 0) {
                                isSnapDxValid = false;
                                break;
                            }
                            const noteWidth = pos.el.offsetWidth;
                            const timeline = pos.el.parentElement;
                            const staticNotes = Array.from(timeline.children).filter(child => !child.classList.contains('selected'));
                            for (const staticNote of staticNotes) {
                                const staticLeft = staticNote.offsetLeft;
                                const staticWidth = staticNote.offsetWidth;
                                if (newLeft < staticLeft + staticWidth && newLeft + noteWidth > staticLeft) {
                                    isSnapDxValid = false;
                                    break;
                                }
                            }
                            if (!isSnapDxValid) break;
                        }

                        if (isSnapDxValid) {
                            foundSnap = true;
                            const distance = Math.abs(dx - snapDx);
                            if (distance < minDistance) {
                                minDistance = distance;
                                bestDx = snapDx;
                            }
                        }
                    }
                    if (!foundSnap) {
                        moveNotes = false;
                    }
                }

                if (moveNotes) {
                    // Snap to grid
                    const gridSizePixels = 0.5 * stepWidth;
                    const snappedDx = Math.round(bestDx / gridSizePixels) * gridSizePixels;
                    let finalDx = bestDx;
                    const snapTolerance = 4; // pixels

                    if (Math.abs(bestDx - snappedDx) < snapTolerance) {
                        finalDx = snappedDx;
                    }

                    initialPositions.forEach(pos => {
                        pos.el.style.left = (pos.left + finalDx) + 'px';
                    });
                }
            }

            function onMouseUp(upEvent) {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                initialPositions.forEach(pos => {
                    const finalLeft = pos.el.offsetLeft;
                    pos.note.start = finalLeft / stepWidth;
                });
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

        } else {
            // Dragging or resizing a single note
            const initialLeft = noteElement.offsetLeft;
            const initialWidth = noteElement.offsetWidth;
            const noteObject = tracks.find(n => n.id == note.id);

            const isResizingRight = noteElement.style.cursor === 'e-resize';
            const isResizingLeft = noteElement.style.cursor === 'w-resize';

            function onMouseMove(moveEvent) {
                const dx = moveEvent.pageX - initialX;
                let newLeft = initialLeft;
                let newWidth = initialWidth;
                const gridSizePixels = 0.5 * stepWidth;

                if (isResizingRight) {
                    newWidth = initialWidth + dx;
                    const roundedRight = Math.round((initialLeft + newWidth) / gridSizePixels) * gridSizePixels;
                    const snapTolerance = 4;
                    if (Math.abs((initialLeft + newWidth) - roundedRight) < snapTolerance) {
                        newWidth = roundedRight - initialLeft;
                    }
                } else if (isResizingLeft) {
                    newLeft = initialLeft + dx;
                    newWidth = initialWidth - dx;
                    const roundedLeft = Math.round(newLeft / gridSizePixels) * gridSizePixels;
                    const snapTolerance = 4;
                    if (Math.abs(newLeft - roundedLeft) < snapTolerance) {
                        newWidth = (initialLeft + initialWidth) - roundedLeft;
                        newLeft = roundedLeft;
                    }
                } else { // Moving
                    newLeft = initialLeft + dx;

                    // Snap to other notes
                    let snapToNote = null;
                    const otherNotes = Array.from(timeline.children).filter(child => child !== noteElement && !child.classList.contains('selected'));
                    for (const otherNote of otherNotes) {
                        const rect = otherNote.getBoundingClientRect();
                        if (moveEvent.clientX >= rect.left && moveEvent.clientX <= rect.right &&
                            moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
                            snapToNote = otherNote;
                            break;
                        }
                    }

                    if (snapToNote) {
                        const snapLeft = snapToNote.offsetLeft;
                        const snapWidth = snapToNote.offsetWidth;
                        const noteWidth = noteElement.offsetWidth;

                        const snapToEnd = snapLeft + snapWidth;
                        const snapToStart = snapLeft - noteWidth;

                        const distToEnd = Math.abs(newLeft - snapToEnd);
                        const distToStart = Math.abs(newLeft - snapToStart);

                        if (distToStart < distToEnd) {
                            newLeft = snapToStart;
                        } else {
                            newLeft = snapToEnd;
                        }
                    } else {
                        // Grid snapping
                        const gridSizePixels = 0.5 * stepWidth;
                        const snappedLeft = Math.round(newLeft / gridSizePixels) * gridSizePixels;
                        const snapTolerance = 4; // pixels
                        if (Math.abs(newLeft - snappedLeft) < snapTolerance) {
                            newLeft = snappedLeft;
                        }
                    }
                }

                // Collision detection
                if (newLeft < 0) {
                    newLeft = 0;
                }
                const otherNotes = Array.from(timeline.children).filter(child => child !== noteElement && !child.classList.contains('selected'));
                let collision = false;
                for (const otherNote of otherNotes) {
                    const otherLeft = otherNote.offsetLeft;
                    const otherWidth = otherNote.offsetWidth;
                    if (newLeft < otherLeft + otherWidth && newLeft + newWidth > otherLeft) {
                        collision = true;
                        break;
                    }
                }

                if (!collision) {
                    if (isResizingRight) {
                        if (newWidth > 0) {
                            noteElement.style.width = newWidth + 'px';
                        }
                    } else if (isResizingLeft) {
                        if (newWidth > 0) {
                            noteElement.style.left = newLeft + 'px';
                            noteElement.style.width = newWidth + 'px';
                        }
                    } else { // Moving
                        noteElement.style.left = newLeft + 'px';
                    }
                }
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                const finalLeft = noteElement.offsetLeft;
                const finalWidth = noteElement.offsetWidth;
                const gridSizePixels = 0.5 * stepWidth;

                const snappedLeft = Math.round(finalLeft / gridSizePixels) * gridSizePixels;
                const snappedWidth = Math.round(finalWidth / gridSizePixels) * gridSizePixels;

                noteElement.style.left = snappedLeft + 'px';
                noteElement.style.width = snappedWidth + 'px';

                noteObject.start = snappedLeft / stepWidth;
                noteObject.duration = snappedWidth / stepWidth;
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    });

    timeline.appendChild(noteElement);
}

MusicMaker.renderAllNotes = function() {
    document.querySelectorAll('.note').forEach(el => el.remove());
    tracks.forEach(note => MusicMaker.renderNote(note));
};