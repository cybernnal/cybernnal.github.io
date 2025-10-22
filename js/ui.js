var MusicMaker = MusicMaker || {};

// The 13 pitches that make up a single user-defined "octave"
const OCTAVE_PITCH_NAMES = ['F#', 'F', 'E', 'D#', 'D', 'C#', 'C', 'B', 'A#', 'A', 'G#', 'G', 'LF#'];
const SIZES = ['tiny', 'small', 'medium', 'large', 'huge'];

// Create a master list of all pitches from highest to lowest for continuous color gradient
const ALL_PITCH_NAMES = [];
for (let octaveNum = 5; octaveNum >= 1; octaveNum--) {
    OCTAVE_PITCH_NAMES.forEach(pitchName => {
        ALL_PITCH_NAMES.push(pitchName + octaveNum);
    });
}

MusicMaker.instruments = {};

MusicMaker.populateInstrumentSelector = function() {
    const selector = document.getElementById('instrument-selector');
    selector.innerHTML = ''; // Clear existing options

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Instrument';
    selector.appendChild(defaultOption);

    for (const instrumentName in MusicMaker.instruments) {
        const option = document.createElement('option');
        option.value = instrumentName;
        option.textContent = instrumentName.charAt(0).toUpperCase() + instrumentName.slice(1);
        selector.appendChild(option);
    }

    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Custom';
    selector.appendChild(customOption);
};


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

    let newInstrumentName;
    if (isButton) {
        const existingInstrumentElements = trackGroupContainer.querySelectorAll('.track');
        const usedInstruments = Array.from(existingInstrumentElements).map(el => el.dataset.instrument);
        const allInstruments = Object.keys(MusicMaker.instruments);
        newInstrumentName = allInstruments.find(inst => !usedInstruments.includes(inst));

        if (!newInstrumentName) {
            let customInstrumentIndex = 1;
            while (MusicMaker.instruments[`custom${customInstrumentIndex}`]) {
                customInstrumentIndex++;
            }
            newInstrumentName = `custom${customInstrumentIndex}`;

            const usedHues = Object.values(MusicMaker.instruments).map(inst => inst.hue);
            let randomHue;
            do {
                randomHue = Math.floor(Math.random() * 360);
            } while (usedHues.includes(randomHue));

            MusicMaker.instruments[newInstrumentName] = {
                sizes: ["tiny", "small", "medium", "large", "huge"],
                hue: randomHue,
                saturation: 70
            };

            const selector = document.getElementById('instrument-selector');
            const option = document.createElement('option');
            option.value = newInstrumentName;
            option.textContent = newInstrumentName.charAt(0).toUpperCase() + newInstrumentName.slice(1);
            selector.insertBefore(option, selector.lastChild);
        }
    } else {
        newInstrumentName = instrumentName;
    }

    const track = document.createElement('div');
    track.className = 'track';
    track.dataset.pitch = fullPitchName;
    track.dataset.instrument = newInstrumentName;

    track.addEventListener('mouseenter', () => {
        track.classList.add('highlighted');
    });

    track.addEventListener('mouseleave', () => {
        track.classList.remove('highlighted');
    });

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
            const associatedNotes = tracks.filter(note => note.pitch === fullPitchName && note.instrumentName === newInstrumentName);
            const noteIdsToRemove = new Set(associatedNotes.map(n => n.id));

            // Remove notes from the main tracks array
            tracks = tracks.filter(note => !noteIdsToRemove.has(note.id));

            // Remove the track element from the DOM
            track.remove();

            // Save the updated state
            MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout(), MusicMaker.instruments);
            
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

        const notesOnTimeline = tracks.filter(n => n.pitch === fullPitchName && n.instrumentName === newInstrumentName);

        const isColliding = (start, duration) => {
            for (const note of notesOnTimeline) {
                if (start < note.start + note.duration && start + duration > note.start) {
                    return true;
                }
            }
            return false;
        };

        let finalStart = snappedStart;
        if (isColliding(finalStart, 1)) {
            let searchPos = finalStart;
            while (isColliding(searchPos, 1)) {
                const collidingNote = notesOnTimeline.find(note => searchPos < note.start + note.duration && searchPos + 1 > note.start);
                if (collidingNote) {
                    searchPos = collidingNote.start + collidingNote.duration;
                } else {
                    // Fallback, should not be reached if logic is correct
                    searchPos += GRID_TIME_UNIT;
                }
            }
            finalStart = searchPos;
        }
        
        // Snap to grid
        finalStart = Math.round(finalStart / GRID_TIME_UNIT) * GRID_TIME_UNIT;


        const newNote = {
            id: Date.now() + Math.random(),
            instrumentName: newInstrumentName,
            size: size,
            pitch: fullPitchName,
            start: finalStart,
            duration: 1
        };
        tracks.push(newNote);
        MusicMaker.renderNote(newNote);
        MusicMaker.updateSongTotalTime();
        checkAndGrowTimeline(newNote);
        MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout(), MusicMaker.instruments);
    });

    track.appendChild(trackHeader);
    track.appendChild(timeline);
    trackGroupContainer.appendChild(track);

    if (isButton) {
        MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout(), MusicMaker.instruments);
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


MusicMaker.updateNoteAppearance = function(noteElement, noteData) {
    noteElement.textContent = noteData.instrumentName.substring(0, 3);

    const instrument = MusicMaker.instruments[noteData.instrumentName];
    const hue = instrument ? instrument.hue : 200;
    const saturation = instrument ? instrument.saturation : 70;

    const overallPitchIndex = ALL_PITCH_NAMES.indexOf(noteData.pitch);
    const totalPitches = ALL_PITCH_NAMES.length;

    const maxLightness = 90;
    const minLightness = 25;
    const lightnessRange = maxLightness - minLightness;

    // Map the pitch index (0 to totalPitches-1) to the lightness range
    const lightness = maxLightness - (overallPitchIndex / (totalPitches - 1)) * lightnessRange;

    noteElement.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    noteElement.style.borderColor = `hsl(${hue}, ${saturation}%, ${lightness - 20}%)`;
};

MusicMaker.renderNote = function(note) {
    let timeline = document.querySelector(`.track[data-pitch="${note.pitch}"][data-instrument="${note.instrumentName}"] .timeline`);
    
    // If timeline doesn't exist, create it on the fly
    if (!timeline) {
        const size = SIZES.find((s, i) => note.pitch.endsWith(String(5 - i)));
        if (size) {
            MusicMaker.addTrack(note.pitch, size, false, null, note.instrumentName);
            timeline = document.querySelector(`.track[data-pitch="${note.pitch}"][data-instrument="${note.instrumentName}"] .timeline`);
        }
    }

    if (!timeline) {
        console.warn(`Timeline not found for note and could not be created:`, note);
        return;
    }

    const noteElement = document.createElement('div');
    noteElement.className = 'note';
    MusicMaker.updateNoteAppearance(noteElement, note);


    noteElement.style.left = (note.start * stepWidth) + 'px';
    noteElement.style.width = (note.duration * stepWidth) + 'px';
    noteElement.dataset.noteId = note.id;

    noteElement.dataset.lastRightClick = 0;
    noteElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const now = Date.now();
        const lastRightClick = parseFloat(noteElement.dataset.lastRightClick) || 0;

        if (now - lastRightClick < 300) { // 300ms threshold for double-click
            const clickedNote = e.target;
            if (clickedNote.classList.contains('selected')) {
                const selectedNotes = document.querySelectorAll('.note.selected');
                selectedNotes.forEach(noteElement => {
                    const noteId = noteElement.dataset.noteId;
                    const noteIndex = tracks.findIndex(n => n.id == noteId);
                    if (noteIndex > -1) {
                        tracks.splice(noteIndex, 1);
                    }
                    noteElement.remove();
                });
            } else {
                const noteId = clickedNote.dataset.noteId;
                const noteIndex = tracks.findIndex(n => n.id == noteId);
                if (noteIndex > -1) {
                    tracks.splice(noteIndex, 1);
                }
                clickedNote.remove();
            }
            MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout(), MusicMaker.instruments);
            MusicMaker.updateSelectorToSelection();
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
        MusicMaker.updateSelectorToSelection();
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
                MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout(), MusicMaker.instruments);
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
                MusicMaker.updateSongTotalTime();
                MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout(), MusicMaker.instruments);
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

MusicMaker.comparePitches = function(pitchA, pitchB) {
    const octaveA = parseInt(pitchA.slice(-1));
    const octaveB = parseInt(pitchB.slice(-1));

    if (octaveA !== octaveB) {
        return octaveA - octaveB; // Higher octave number is higher pitch
    }

    const nameA = pitchA.slice(0, -1);
    const nameB = pitchB.slice(0, -1);

    const indexA = OCTAVE_PITCH_NAMES.indexOf(nameA);
    const indexB = OCTAVE_PITCH_NAMES.indexOf(nameB);

    // Lower index in OCTAVE_PITCH_NAMES is higher pitch
    return indexB - indexA;
};

MusicMaker.updateSelectorToSelection = function() {
    const selector = document.getElementById('instrument-selector');
    const selectedNoteElements = document.querySelectorAll('.note.selected');

    if (selectedNoteElements.length === 0) {
        selector.value = ''; // Reset to default
        return;
    }

    const selectedNotesData = [];
    selectedNoteElements.forEach(el => {
        const note = tracks.find(n => String(n.id) === el.dataset.noteId);
        if (note) {
            selectedNotesData.push(note);
        }
    });

    if (selectedNotesData.length === 0) {
        selector.value = '';
        return;
    }

    // Sort by pitch to find the highest one
    selectedNotesData.sort((a, b) => MusicMaker.comparePitches(b.pitch, a.pitch));

    const highestPitchNote = selectedNotesData[0];
    selector.value = highestPitchNote.instrumentName;
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

        MusicMaker.Storage.save(tracks, songTotalTime, MusicMaker.getTrackLayout(), MusicMaker.instruments);

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
function checkAndGrowTimeline(newNote) {
    const noteEndTimeInUnits = newNote.start + newNote.duration;
    const remainingTimeInUnits = songTotalTime - noteEndTimeInUnits;
    const thresholdInUnits = AUTOGROW_THRESHOLD_SECONDS / TIME_UNIT_TO_SECONDS;

    if (remainingTimeInUnits < thresholdInUnits) {
        const growAmountInUnits = AUTOGROW_AMOUNT_SECONDS / TIME_UNIT_TO_SECONDS;
        songTotalTime += growAmountInUnits;
        updateTimelineWidth();
    }
}

function updateTimelineWidth() {
    const timelines = document.querySelectorAll('.timeline');
    const separators = document.querySelectorAll('.octave-separator');
    const newWidth = songTotalTime * stepWidth;
    timelines.forEach(timeline => {
        timeline.style.minWidth = newWidth + 'px';
    });
    separators.forEach(separator => {
        separator.style.minWidth = (newWidth + TRACK_HEADER_WIDTH) + 'px';
    });
}
