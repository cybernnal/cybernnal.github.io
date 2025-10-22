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

const GRID_TIME_UNIT = 0.25;

MusicMaker.createUI = function(trackLayout = null) {
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = ''; // Clear previous UI

    // Loop through each size to create 5 distinct blocks
    SIZES.forEach((size, index) => {
        const octaveNum = 5 - index; // 5 for tiny, 4 for small, etc.

        // Create the rows for this octave block
        OCTAVE_PITCH_NAMES.forEach(pitchName => {
            const fullPitchName = pitchName + octaveNum;

            const trackGroupContainer = document.createElement('div');
            trackGroupContainer.className = 'track-group-container';
            trackGroupContainer.dataset.pitch = fullPitchName;

            const instruments = (trackLayout && trackLayout[fullPitchName]) ? trackLayout[fullPitchName] : ['diapason'];
            
            instruments.forEach(instrumentName => {
                MusicMaker.addTrack(fullPitchName, size, false, trackGroupContainer, instrumentName);
            });

            const allTracks = Array.from(trackGroupContainer.querySelectorAll('.track'));
            allTracks.forEach((t, i) => {
                const btn = t.querySelector('.expand-btn');
                if (btn) {
                    btn.style.visibility = (i === 0 && allTracks.length > 1) ? 'visible' : 'hidden';
                }
            });

            appContainer.appendChild(trackGroupContainer);
        });

        // Add a separator after each block, except the last one
        if (index < SIZES.length - 1) {
            const separator = document.createElement('div');
            separator.className = 'octave-separator';
            appContainer.appendChild(separator);
        }
    });
};

MusicMaker.addTrack = function(fullPitchName, size, isButton, container = null, instrumentName = 'diapason') {
    const trackGroupContainer = container || document.querySelector(`.track-group-container[data-pitch="${fullPitchName}"]`);
    if (!trackGroupContainer) return;

    const newInstrumentName = isButton ? 'diapason' : instrumentName;

    const track = document.createElement('div');
    track.className = 'track';
    track.dataset.pitch = fullPitchName;

    const trackHeader = document.createElement('div');
    trackHeader.className = 'track-header';

    const key = document.createElement('div');
    const isBlackKey = fullPitchName.includes('#');
    key.className = `key ${isBlackKey ? 'key--black' : 'key--white'}`;
    key.textContent = fullPitchName;

    const trackControls = document.createElement('div');
    trackControls.className = 'track-controls';

    const isMainTrack = trackGroupContainer.querySelectorAll('.track').length === 0;

    if (isMainTrack) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.textContent = '▼';
        expandBtn.style.visibility = 'hidden'; // Initially hidden
        expandBtn.onclick = () => MusicMaker.toggleTrackGroup(fullPitchName);
        trackControls.appendChild(expandBtn);

        const addBtn = document.createElement('button');
        addBtn.className = 'add-btn';
        addBtn.textContent = '+';
        addBtn.onclick = () => MusicMaker.addTrack(fullPitchName, size, true, trackGroupContainer);
        trackControls.appendChild(addBtn);
    } else {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<b>X</b>';
        deleteBtn.onclick = () => {
            track.remove();
            tracks = tracks.filter(note => !(note.pitch === fullPitchName && note.instrumentName === newInstrumentName));
            MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout());
            
            const allTracks = Array.from(trackGroupContainer.querySelectorAll('.track'));
            const firstTrack = allTracks[0];
            if (firstTrack) {
                const expandBtn = firstTrack.querySelector('.expand-btn');
                if (expandBtn) {
                    expandBtn.style.visibility = allTracks.length > 1 ? 'visible' : 'hidden';
                }
            }
        };
        trackControls.appendChild(deleteBtn);
    }

    key.appendChild(trackControls);
    trackHeader.appendChild(key);

    const timeline = document.createElement('div');
    timeline.className = 'timeline';
    timeline.dataset.instrument = newInstrumentName;

    timeline.addEventListener('dblclick', (e) => {
        if (e.button !== 0) return;
        const startPosition = e.offsetX / stepWidth;
        const snappedStart = Math.round(startPosition / GRID_TIME_UNIT) * GRID_TIME_UNIT;
        const newNote = {
            id: Date.now() + Math.random(),
            instrumentName: newInstrumentName,
            size: size,
            pitch: fullPitchName,
            start: snappedStart,
            duration: 1
        };
        tracks.push(newNote);
        MusicMaker.renderNote(newNote);
        MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout());
    });

    track.appendChild(trackHeader);
    track.appendChild(timeline);
    trackGroupContainer.appendChild(track);

    if (isButton) {
        MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout());
    }

    // After adding, update the main track's expand button
    const allTracks = Array.from(trackGroupContainer.querySelectorAll('.track'));
    const firstTrack = allTracks[0];
    if (firstTrack) {
        const expandBtn = firstTrack.querySelector('.expand-btn');
        if (expandBtn) {
            expandBtn.style.visibility = allTracks.length > 1 ? 'visible' : 'hidden';
        }
    }
};

MusicMaker.toggleTrackGroup = function(fullPitchName) {
    const trackGroupContainer = document.querySelector(`.track-group-container[data-pitch="${fullPitchName}"]`);
    if (!trackGroupContainer) return;

    const tracksElements = trackGroupContainer.querySelectorAll('.track');
    const firstTrack = trackGroupContainer.querySelector('.track');
    if (!firstTrack) return;

    const expandBtn = firstTrack.querySelector('.expand-btn');
    if (!expandBtn) return;

    if (tracksElements.length <= 1) {
        expandBtn.style.visibility = 'hidden';
        return;
    }

    trackGroupContainer.classList.toggle('collapsed');

    if (trackGroupContainer.classList.contains('collapsed')) {
        expandBtn.textContent = '▶';
        tracksElements.forEach((track, index) => {
            if (index > 0) {
                track.style.display = 'none';
            }
        });
    } else {
        expandBtn.textContent = '▼';
        tracksElements.forEach((track, index) => {
            if (index > 0) {
                track.style.display = 'flex';
            }
        });
    }
};


MusicMaker.renderNote = function(note) {
    const timeline = document.querySelector(`.track[data-pitch="${note.pitch}"] .timeline[data-instrument="${note.instrumentName}"]`);
    if (!timeline) {
        console.warn(`Timeline not found for note:`, note);
        return;
    }

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
            MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout());
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
        let durationTooltip = null;

        if (isResizing) {
            durationTooltip = document.createElement('div');
            durationTooltip.id = 'duration-tooltip';
            document.body.appendChild(durationTooltip);
        }

        if (noteElement.classList.contains('selected') && !isResizing) {
            // Dragging multiple notes
            const selectedNotes = Array.from(document.querySelectorAll('.note.selected'));
            const initialPositions = selectedNotes.map(n => ({ el: n, left: n.offsetLeft, note: tracks.find(nt => nt.id == n.dataset.noteId) }));

            function onMouseMove(moveEvent) {
                const dx = moveEvent.pageX - initialX;
                const targetTimeline = initialPositions[0].el.parentElement;
                const finalDx = findValidDragPosition(initialPositions, dx, targetTimeline);

                if (finalDx !== null) {
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
                MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout());
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
                const gridSizePixels = GRID_TIME_UNIT * stepWidth;

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
                        const gridSizePixels = GRID_TIME_UNIT * stepWidth;
                        const snappedLeft = Math.round(newLeft / gridSizePixels) * gridSizePixels;
                        const snapTolerance = 4; // pixels
                        if (Math.abs(newLeft - snappedLeft) < snapTolerance) {
                            newLeft = snappedLeft;
                        }
                    }
                }

                if (durationTooltip) {
                    const duration = newWidth / stepWidth;
                    durationTooltip.textContent = `Duration: ${duration.toFixed(2)}`;
                    durationTooltip.style.left = moveEvent.pageX + 15 + 'px';
                    durationTooltip.style.top = moveEvent.pageY + 15 + 'px';
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

                if (durationTooltip) {
                    document.body.removeChild(durationTooltip);
                    durationTooltip = null;
                }

                const finalLeft = noteElement.offsetLeft;
                const finalWidth = noteElement.offsetWidth;
                const gridSizePixels = GRID_TIME_UNIT * stepWidth;

                const snappedLeft = Math.round(finalLeft / gridSizePixels) * gridSizePixels;
                const snappedWidth = Math.round(finalWidth / gridSizePixels) * gridSizePixels;

                noteElement.style.left = snappedLeft + 'px';
                noteElement.style.width = snappedWidth + 'px';

                noteObject.start = snappedLeft / stepWidth;
                noteObject.duration = snappedWidth / stepWidth;
                MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout());
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

MusicMaker.getTrackLayout = function() {
    const layout = {};
    const trackGroupContainers = document.querySelectorAll('.track-group-container');
    trackGroupContainers.forEach(container => {
        const pitch = container.dataset.pitch;
        if (pitch) {
            const instruments = [];
            const timelines = container.querySelectorAll('.timeline');
            timelines.forEach(timeline => {
                const instrument = timeline.dataset.instrument;
                if (instrument) {
                    instruments.push(instrument);
                }
            });
            if (instruments.length > 0) {
                layout[pitch] = instruments;
            }
        }
    });
    return layout;
};

function findValidDragPosition(initialPositions, dx, targetTimeline) {
    let bestDx = dx;
    let moveNotes = true;

    let collision = false;
    for (const pos of initialPositions) {
        const newLeft = pos.left + dx;
        if (newLeft < 0) {
            collision = true;
            break;
        }
        const noteWidth = pos.el.offsetWidth;
        const staticNotes = Array.from(targetTimeline.children).filter(child => !child.classList.contains('selected') && !child.classList.contains('ghost-note'));
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
        const snapCandidates = [];
        for (const pos of initialPositions) {
            const newLeft = pos.left + dx;
            if (newLeft < 0) {
                snapCandidates.push(-pos.left);
            }
            const noteWidth = pos.el.offsetWidth;
            const staticNotes = Array.from(targetTimeline.children).filter(child => !child.classList.contains('selected') && !child.classList.contains('ghost-note'));
            for (const staticNote of staticNotes) {
                const staticLeft = staticNote.offsetLeft;
                const staticWidth = staticNote.offsetWidth;
                if (newLeft < staticLeft + staticWidth && newLeft + noteWidth > staticLeft) {
                    snapCandidates.push((staticLeft - noteWidth) - pos.left);
                    snapCandidates.push((staticLeft + staticWidth) - pos.left);
                }
            }
        }

        let minDistance = Infinity;
        let foundSnap = false;
        for (const snapDx of snapCandidates) {
            let isSnapDxValid = true;
            for (const pos of initialPositions) {
                const newLeft = pos.left + snapDx;
                if (newLeft < 0) {
                    isSnapDxValid = false;
                    break;
                }
                const noteWidth = pos.el.offsetWidth;
                const staticNotes = Array.from(targetTimeline.children).filter(child => !child.classList.contains('selected') && !child.classList.contains('ghost-note'));
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
        const gridSizePixels = GRID_TIME_UNIT * stepWidth;
        const snappedDx = Math.round(bestDx / gridSizePixels) * gridSizePixels;
        if (Math.abs(bestDx - snappedDx) < 4) {
            return snappedDx;
        }
        return bestDx;
    }

    return null;
}

function findValidPastePosition(ghostNotes, baseTimeline, allTimelines, desiredDx) {
    const baseTimelineIndex = allTimelines.indexOf(baseTimeline);

    const checkPosition = (dx) => {
        for (const gn of ghostNotes) {
            const targetIndex = baseTimelineIndex + gn.data.trackOffset;
            if (targetIndex < 0 || targetIndex >= allTimelines.length) {
                return false;
            }
            const targetTimeline = allTimelines[targetIndex];
            const newLeft = gn.data.start * stepWidth + dx;
            const noteWidth = gn.el.offsetWidth;

            if (newLeft < 0) return false;

            const staticNotes = Array.from(targetTimeline.children).filter(child => !child.classList.contains('ghost-note'));
            for (const staticNote of staticNotes) {
                const staticLeft = staticNote.offsetLeft;
                const staticWidth = staticNote.offsetWidth;
                if (newLeft < staticLeft + staticWidth && newLeft + noteWidth > staticLeft) {
                    return false;
                }
            }
        }
        return true;
    };

    if (checkPosition(desiredDx)) {
        return desiredDx;
    }

    const snapCandidates = new Set();
    for (const gn of ghostNotes) {
        const targetIndex = baseTimelineIndex + gn.data.trackOffset;
        if (targetIndex < 0 || targetIndex >= allTimelines.length) continue;

        const targetTimeline = allTimelines[targetIndex];
        const noteWidth = gn.el.offsetWidth;
        const staticNotes = Array.from(targetTimeline.children).filter(child => !child.classList.contains('ghost-note'));

        for (const staticNote of staticNotes) {
            const staticLeft = staticNote.offsetLeft;
            const staticWidth = staticNote.offsetWidth;
            snapCandidates.add(staticLeft + staticWidth - (gn.data.start * stepWidth));
            snapCandidates.add(staticLeft - noteWidth - (gn.data.start * stepWidth));
        }
        snapCandidates.add(-(gn.data.start * stepWidth));
    }

    let bestDx = null;
    let minDistance = Infinity;

    for (const candidateDx of snapCandidates) {
        const gridSizePixels = GRID_TIME_UNIT * stepWidth;
        const snappedDx = Math.round(candidateDx / gridSizePixels) * gridSizePixels;

        if (checkPosition(snappedDx)) {
            const distance = Math.abs(snappedDx - desiredDx);
            if (distance < minDistance) {
                minDistance = distance;
                bestDx = snappedDx;
            }
        }
    }

    return bestDx;
}

MusicMaker.startPasting = function(notesToPaste) {
    const appContainer = document.getElementById('app-container');
    let isPastePositionValid = true;
    let baseTimeline = null;
    let finalDx = 0;

    const timelineHeight = 15;
    const noteHeight = timelineHeight * 0.8;
    const noteTopMargin = timelineHeight * 0.1;

    const ghostNotes = notesToPaste.map(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'note ghost-note';
        noteElement.style.width = (note.duration * stepWidth) + 'px';
        noteElement.style.height = noteHeight + 'px';
        noteElement.style.pointerEvents = 'none';
        noteElement.style.backgroundColor = 'rgba(100, 100, 255, 0.5)';
        noteElement.style.position = 'absolute';
        noteElement.style.opacity = '0';
        appContainer.appendChild(noteElement);
        return { el: noteElement, data: note, currentTimeline: null };
    });

    function updateGhostNotesPosition(e) {
        const allTimelines = Array.from(document.querySelectorAll('.timeline')).filter(tl => tl.offsetParent !== null);
        const containerRect = appContainer.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left + appContainer.scrollLeft;

        let elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
        let timelineUnderMouse = elementUnderMouse ? elementUnderMouse.closest('.timeline') : null;

        // Make vertical selection sticky: if mouse is off a track, use the last known one
        if (timelineUnderMouse) {
            baseTimeline = timelineUnderMouse;
        }

        if (!baseTimeline) {
            ghostNotes.forEach(gn => gn.el.style.opacity = '0');
            isPastePositionValid = false;
            return;
        }

        const timelineRect = baseTimeline.getBoundingClientRect();
        const timelineXStart = timelineRect.left - containerRect.left + appContainer.scrollLeft;
        const mouseXInTimeline = mouseX - timelineXStart;

        const firstNoteData = ghostNotes[0].data;
        const desiredDxInTimeline = mouseXInTimeline - (firstNoteData.start * stepWidth);

        const calculatedDx = findValidPastePosition(ghostNotes, baseTimeline, allTimelines, desiredDxInTimeline);

        if (calculatedDx !== null) {
            finalDx = calculatedDx;
            isPastePositionValid = true;
        } else {
            finalDx = desiredDxInTimeline;
            isPastePositionValid = false;
        }

        const baseTimelineIndex = allTimelines.indexOf(baseTimeline);
        ghostNotes.forEach(gn => {
            const targetIndex = baseTimelineIndex + gn.data.trackOffset;
            if (targetIndex >= 0 && targetIndex < allTimelines.length) {
                const targetTimeline = allTimelines[targetIndex];
                const targetTimelineRect = targetTimeline.getBoundingClientRect();
                const targetTimelineXStart = targetTimelineRect.left - containerRect.left + appContainer.scrollLeft;

                gn.el.style.top = (targetTimelineRect.top - containerRect.top + appContainer.scrollTop + noteTopMargin) + 'px';
                gn.el.style.left = (targetTimelineXStart + gn.data.start * stepWidth + finalDx) + 'px';
                gn.el.style.opacity = '1';
                gn.currentTimeline = targetTimeline;
                gn.el.style.backgroundColor = isPastePositionValid ? 'rgba(100, 100, 255, 0.5)' : 'rgba(255, 100, 100, 0.5)';
            } else {
                gn.el.style.opacity = '0';
                gn.currentTimeline = null;
            }
        });
    }

    function finalizePaste(e) {
        if (!isPastePositionValid) {
            return cancelPaste();
        }

        const newNotes = [];
        const allTimelines = Array.from(document.querySelectorAll('.timeline')).filter(tl => tl.offsetParent !== null);
        const finalValidationDx = findValidPastePosition(ghostNotes, baseTimeline, allTimelines, finalDx);

        if (finalValidationDx === null) {
            return cancelPaste();
        }

        ghostNotes.forEach(ghostNote => {
            if (ghostNote.currentTimeline) {
                const noteData = ghostNote.data;
                const newStart = (noteData.start * stepWidth + finalValidationDx) / stepWidth;
                newNotes.push({
                    id: Date.now() + Math.random(),
                    instrumentName: ghostNote.currentTimeline.dataset.instrument,
                    size: noteData.size,
                    pitch: ghostNote.currentTimeline.parentElement.dataset.pitch,
                    start: newStart,
                    duration: noteData.duration
                });
            }
        });

        newNotes.forEach(note => {
            tracks.push(note);
            MusicMaker.renderNote(note);
        });

        MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout());

        cleanup();
    }

    function cancelPaste() {
        cleanup();
    }

    function cleanup() {
        ghostNotes.forEach(gn => {
            if (gn.el.parentElement) {
                gn.el.parentElement.removeChild(gn.el);
            }
        });
        document.removeEventListener('mousemove', updateGhostNotesPosition);
        document.removeEventListener('mousedown', onMouseDown, true);
        document.removeEventListener('keydown', onKeyDown);
    }

    function onMouseDown(e) {
        if (e.button === 0) {
            finalizePaste(e);
        }
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            cancelPaste();
        }
    }

    document.addEventListener('mousemove', updateGhostNotesPosition);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown);
};