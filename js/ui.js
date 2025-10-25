var MusicMaker = MusicMaker || {};

MusicMaker.tracks = [];
MusicMaker.notes = [];

let stepWidth = 50;
let minNoteDuration = 1;

const tempo3Durations = [];
for (let i = 1; i <= 300; i++) { // Generate for durations up to 100
    tempo3Durations.push(Math.floor(i / 3 * 100) / 100);
    if (i <= 200) {
        tempo3Durations.push(i / 2);
    }
}
const uniqueSortedTempo3Durations = [...new Set(tempo3Durations)].sort((a, b) => a - b).filter(d => d > 0);

function snapToTempo3Grid(duration) {
    if (duration <= 0) return uniqueSortedTempo3Durations[0];
    // find closest value in uniqueSortedTempo3Durations
    let closest = uniqueSortedTempo3Durations[0];
    let minDiff = Math.abs(duration - closest);
    for (const val of uniqueSortedTempo3Durations) {
        const diff = Math.abs(duration - val);
        if (diff < minDiff) {
            minDiff = diff;
            closest = val;
        }
    }
    return closest;
}

document.addEventListener('DOMContentLoaded', () => {
    const tempoSlider = document.getElementById('tempo-slider');
    const tempoValue = document.getElementById('tempo-value');

    if (tempoSlider) {
        tempoSlider.addEventListener('input', (e) => {
            const newTempo = parseInt(e.target.value, 10);
            tempoValue.textContent = newTempo;

            const playback = MusicMaker.Playback;
            if (playback && !playback.isPlaying) {
                const oldTempo = playback.currentTempo;
                if (oldTempo !== newTempo) {
                    const oldTimeUnit = 0.05 * oldTempo;
                    // Avoid division by zero if oldTimeUnit is 0
                    const positionInBeats = oldTimeUnit > 0 ? playback.playbackPosition / oldTimeUnit : 0;

                    const newTimeUnit = 0.05 * newTempo;
                    playback.playbackPosition = positionInBeats * newTimeUnit;

                    // Update the currentTempo on the playback object immediately
                    playback.currentTempo = newTempo;

                    // Update the visual cursor position
                    MusicMaker.updateCursor(playback.playbackPosition);
                }
            }

            MusicMaker.drawTimelineRuler();

            switch (newTempo) {
                case 1:
                    minNoteDuration = 1;
                    break;
                case 2:
                    minNoteDuration = 0.5;
                    break;
                case 3:
                    minNoteDuration = 0.33;
                    break;
                case 4:
                    minNoteDuration = 0.25;
                    break;
            }
        });
    }

    const zoomSlider = document.getElementById('zoom-slider');
    if (zoomSlider) {
        zoomSlider.addEventListener('input', (e) => {
            stepWidth = parseInt(e.target.value, 10);
            updateTimelineWidth();
            MusicMaker.renderAllNotes();
            MusicMaker.updateCursor(MusicMaker.Playback.playbackPosition);
        });
    }
});

// The 13 pitches that make up a single user-defined "octave"
MusicMaker.OCTAVE_PITCH_NAMES = ['F#', 'F', 'E', 'D#', 'D', 'C#', 'C', 'B', 'A#', 'A', 'G#', 'G', 'LF#'];
const SIZES = ['tiny', 'small', 'medium', 'large', 'huge'];

// Create a master list of all pitches from highest to lowest for continuous color gradient
MusicMaker.ALL_PITCH_NAMES = [];
for (let octaveNum = 5; octaveNum >= 1; octaveNum--) {
    MusicMaker.OCTAVE_PITCH_NAMES.forEach(pitchName => {
        MusicMaker.ALL_PITCH_NAMES.push(pitchName + octaveNum);
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
    customOption.textContent = 'Add Custom';
    selector.appendChild(customOption);
};

MusicMaker.createUI = function(trackLayout = null, collapseState = null) {
    MusicMaker.tracks = [];
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = ''; // Clear previous UI

    const mainContent = document.createElement('div');
    mainContent.id = 'main-content';

    const trackHeadersContainer = document.createElement('div');
    trackHeadersContainer.id = 'track-headers-container';
    const trackHeadersTable = document.createElement('table');
    trackHeadersTable.id = 'track-headers-table';
    const trackHeadersThead = document.createElement('thead');
    const trackHeadersTr = document.createElement('tr');
    const trackHeadersTh = document.createElement('th');
    trackHeadersTh.textContent = 'Instrument';
    trackHeadersTr.appendChild(trackHeadersTh);
    trackHeadersThead.appendChild(trackHeadersTr);
    trackHeadersTable.appendChild(trackHeadersThead);
    const trackHeadersTbody = document.createElement('tbody');
    trackHeadersTable.appendChild(trackHeadersTbody);
    trackHeadersContainer.appendChild(trackHeadersTable);

    const timelineContainer = document.createElement('div');
    timelineContainer.id = 'timeline-container';
    const timelineTable = document.createElement('table');
    timelineTable.id = 'timeline-table';
    const timelineThead = document.createElement('thead');
    const timelineTr = document.createElement('tr');
    const timelineTh = document.createElement('th');
    timelineTh.className = 'timeline-header-cell';
    const timelineRuler = document.createElement('div');
    timelineRuler.id = 'timeline-ruler';
    timelineTh.appendChild(timelineRuler);

    const playbackCursor = document.createElement('div');
    playbackCursor.id = 'playback-cursor';
        timelineContainer.appendChild(playbackCursor);

    timelineTr.appendChild(timelineTh);
    timelineThead.appendChild(timelineTr);
    timelineTable.appendChild(timelineThead);
    const timelineTbody = document.createElement('tbody');
    timelineTable.appendChild(timelineTbody);
    timelineContainer.appendChild(timelineTable);

    mainContent.appendChild(trackHeadersContainer);
    mainContent.appendChild(timelineContainer);
    appContainer.appendChild(mainContent);

    const createdPitches = new Set();

    // Add tracks from the trackLayout
    if (trackLayout) {
        for (const fullPitchName in trackLayout) {
            if (trackLayout.hasOwnProperty(fullPitchName) && fullPitchName !== 'Percussion') {
                const instruments = trackLayout[fullPitchName];
                if (instruments.length > 0) {
                    const parentInstrument = instruments[0]; // The first instrument is the parent
                    const octaveNum = parseInt(fullPitchName.slice(-1));
                    const size = SIZES[5 - octaveNum];
                    const isCollapsed = collapseState ? collapseState[fullPitchName] !== false : true;
                    MusicMaker.addTrack(fullPitchName, size, false, null, parentInstrument, false, isCollapsed);
                    createdPitches.add(fullPitchName);

                    for (let i = 1; i < instruments.length; i++) {
                        const instrumentName = instruments[i];
                        const parentTrack = document.querySelector(`.parent-track[data-pitch="${fullPitchName}"]`);
                        MusicMaker.addTrack(fullPitchName, size, false, parentTrack, instrumentName, true);
                    }
                }
            }
        }
    }

    // Create the default 5 octaves for any pitches not in the layout
    SIZES.forEach((size, index) => {
        const octaveNum = 5 - index; // 5 for tiny, 4 for small, etc.
        MusicMaker.OCTAVE_PITCH_NAMES.forEach(pitchName => {
            const fullPitchName = pitchName + octaveNum;
            if (!createdPitches.has(fullPitchName)) {
                const isCollapsed = collapseState ? collapseState[fullPitchName] !== false : true;
                MusicMaker.addTrack(fullPitchName, size, false, null, 'diapason', false, isCollapsed);
            }
        });
    });


    if (trackLayout && trackLayout['Percussion']) {
        const percussionInstruments = trackLayout['Percussion'];
        MusicMaker.addTrack('Percussion', 'medium', false, null, 'Percussion', false);
        percussionInstruments.forEach(instrumentName => {
            MusicMaker.addTrack('Percussion', 'medium', false, null, instrumentName, true);
        });
    }

    // Restore collapse state
    if (collapseState) {
        const parentTracks = document.querySelectorAll('.parent-track');
        parentTracks.forEach(parent => {
            const pitch = parent.dataset.pitch;
            if (collapseState[pitch]) {
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
            }
        });
    }
};

MusicMaker.createCustomInstrument = function(displayName, exportName) {
    const usedHues = Object.values(MusicMaker.instruments).map(inst => inst.hue);
    let randomHue;
    do {
        randomHue = Math.floor(Math.random() * 360);
    } while (usedHues.includes(randomHue));

    MusicMaker.instruments[displayName] = {
        exportName: exportName,
        sizes: ["tiny", "small", "medium", "large", "huge"],
        hue: randomHue,
        saturation: 70
    };

    const selector = document.getElementById('instrument-selector');
    const option = document.createElement('option');
    option.value = displayName;
    option.textContent = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    selector.insertBefore(option, selector.lastChild);
};

MusicMaker.addTrack = function(fullPitchName, size, isButton, container = null, instrumentName = 'diapason', isChild = false, isCollapsed = true) {
    const headersTbody = document.querySelector('#track-headers-table tbody');
    const timelineTbody = document.querySelector('#timeline-table tbody');

    let newInstrumentName = instrumentName;
    if (isButton) {
        const existingInstrumentElements = Array.from(headersTbody.querySelectorAll(`tr[data-pitch="${fullPitchName}"]`));
        const usedInstruments = existingInstrumentElements.map(el => el.dataset.instrument);
        const allInstruments = Object.keys(MusicMaker.instruments);
        newInstrumentName = allInstruments.find(inst => !usedInstruments.includes(inst));

        if (!newInstrumentName) {
            alert("No more instruments available. Please create a custom instrument first.");
            return;
        }
    }

    const trHeader = document.createElement('tr');
    trHeader.dataset.pitch = fullPitchName;
    trHeader.dataset.instrument = newInstrumentName;

    const trTimeline = document.createElement('tr');
    trTimeline.dataset.pitch = fullPitchName;
    trTimeline.dataset.instrument = newInstrumentName;

    if (isChild) {
        trHeader.classList.add('child-track');
        trTimeline.classList.add('child-track');
    } else {
        trHeader.classList.add('parent-track');
    }

    trHeader.addEventListener('mouseenter', () => {
        trHeader.classList.add('highlighted');
        trTimeline.classList.add('highlighted');
    });

    trHeader.addEventListener('mouseleave', () => {
        trHeader.classList.remove('highlighted');
        trTimeline.classList.remove('highlighted');
    });

    const tdHeader = document.createElement('td');

    const key = document.createElement('div');
    const isBlackKey = fullPitchName.includes('#');
    const isPercussion = fullPitchName === 'Percussion';
    key.className = `key ${isBlackKey ? 'key--black' : 'key--white'} ${isPercussion ? 'key--percussion' : ''}`;
    key.textContent = isChild && isPercussion ? instrumentName : fullPitchName;

    const trackControls = document.createElement('div');
    trackControls.className = 'track-controls';

    if (!isChild) { // This is now a parent track
        if (isCollapsed) {
            trHeader.classList.add('collapsed');
        }
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = isCollapsed ? '&#9654;' : '&#9660;'; // Right or down triangle
        expandBtn.style.visibility = 'hidden'; // Initially hidden

        expandBtn.onclick = (e) => {
            e.stopPropagation();
            const beforeState = MusicMaker.createSnapshot();
            trHeader.classList.toggle('collapsed');
            const isNowCollapsed = trHeader.classList.contains('collapsed');
            expandBtn.innerHTML = isNowCollapsed ? '&#9654;' : '&#9660;';

            let nextHeaderRow = trHeader.nextElementSibling;
            while (nextHeaderRow && nextHeaderRow.classList.contains('child-track') && nextHeaderRow.dataset.pitch === fullPitchName) {
                const timelineRow = document.querySelector(`#timeline-table tbody tr[data-pitch="${fullPitchName}"][data-instrument="${nextHeaderRow.dataset.instrument}"]`);
                nextHeaderRow.style.display = isNowCollapsed ? 'none' : 'table-row';
                if (timelineRow) timelineRow.style.display = isNowCollapsed ? 'none' : 'table-row';
                nextHeaderRow = nextHeaderRow.nextElementSibling;
            }
            MusicMaker.commitChange(beforeState);
        };
        trackControls.appendChild(expandBtn);

        const addBtn = document.createElement('button');
        addBtn.className = 'add-btn';
        addBtn.textContent = '+';
        if (isPercussion) {
            addBtn.style.display = 'none';
        }
        addBtn.onclick = (e) => {
            e.stopPropagation();
            if (trHeader.classList.contains('collapsed')) {
                expandBtn.click();
            }
            MusicMaker.addTrack(fullPitchName, size, true, trHeader, undefined, true, false);
            expandBtn.style.visibility = 'visible';
        };
        trackControls.appendChild(addBtn);

    } else { // Child track
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<b>X</b>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            const beforeState = MusicMaker.createSnapshot();
            const trackIndex = MusicMaker.tracks.findIndex(t => t.pitch === fullPitchName && t.instrumentName === newInstrumentName);
            if (trackIndex > -1) {
                const track = MusicMaker.tracks[trackIndex];
                const parentHeader = document.querySelector(`.parent-track[data-pitch="${fullPitchName}"]`);

                track.trHeader.remove();
                track.trTimeline.remove();
                MusicMaker.tracks.splice(trackIndex, 1);

                const childTracks = document.querySelectorAll(`.child-track[data-pitch="${fullPitchName}"]`);
                if (childTracks.length === 0) {
                    const expandBtn = parentHeader.querySelector('.expand-btn');
                    if(expandBtn) expandBtn.style.visibility = 'hidden';
                }

                MusicMaker.commitChange(beforeState);
                MusicMaker.updateCursorHeight();
            }
        };
        trackControls.appendChild(deleteBtn);
    }

    key.appendChild(trackControls);
    tdHeader.appendChild(key);
    trHeader.appendChild(tdHeader);

    const tdTimeline = document.createElement('td');
    const timeline = document.createElement('div');
    timeline.className = 'timeline-col';
    timeline.dataset.instrument = newInstrumentName;

    timeline.addEventListener('dblclick', (e) => {
        const beforeState = MusicMaker.createSnapshot();
        if (e.button !== 0) return;
        const startPosition = e.offsetX / stepWidth;
        const snappedStart = Math.round(startPosition / 0.25) * 0.25;

        const notesOnTimeline = MusicMaker.notes.filter(n => n.pitch === fullPitchName && n.instrumentName === newInstrumentName);

        const isColliding = (start, duration) => {
            for (const note of notesOnTimeline) {
                if (start < note.start + note.duration && start + duration > note.start) {
                    return true;
                }
            }
            return false;
        };

        let finalStart = snappedStart;
        if (isColliding(finalStart, minNoteDuration)) {
            let searchPos = finalStart;
            while (isColliding(searchPos, minNoteDuration)) {
                const collidingNote = notesOnTimeline.find(note => searchPos < note.start + note.duration && searchPos + minNoteDuration > note.start);
                if (collidingNote) {
                    searchPos = collidingNote.start + collidingNote.duration;
                } else {
                    searchPos += 0.25;
                }
            }
            finalStart = searchPos;
        }
        
        finalStart = Math.round(finalStart / 0.25) * 0.25;

        const newNote = {
            id: Date.now() + Math.random(),
            instrumentName: newInstrumentName,
            size: size,
            pitch: fullPitchName,
            start: finalStart,
            duration: minNoteDuration
        };
        MusicMaker.notes.push(newNote);
        MusicMaker.renderNote(newNote);
        MusicMaker.updateSongTotalTime();
        checkAndGrowTimeline(newNote);
        MusicMaker.commitChange(beforeState);
    });

    tdTimeline.appendChild(timeline);
    trTimeline.appendChild(tdTimeline);

    if (container) { // container is the parent trHeader for a new child track
        let lastChildHeader = container;
        while (lastChildHeader.nextElementSibling && lastChildHeader.nextElementSibling.classList.contains('child-track') && lastChildHeader.nextElementSibling.dataset.pitch === fullPitchName) {
            lastChildHeader = lastChildHeader.nextElementSibling;
        }
        lastChildHeader.after(trHeader);

        const parentTimelineRow = document.querySelector(`#timeline-table tbody tr[data-pitch="${fullPitchName}"][data-instrument="${container.dataset.instrument}"]`);
        if (parentTimelineRow) {
            let lastChildTimeline = parentTimelineRow;
            while (lastChildTimeline.nextElementSibling && lastChildTimeline.nextElementSibling.classList.contains('child-track') && lastChildTimeline.nextElementSibling.dataset.pitch === fullPitchName) {
                lastChildTimeline = lastChildTimeline.nextElementSibling;
            }
            lastChildTimeline.after(trTimeline);
        } else { // Should not happen if container is present
            timelineTbody.appendChild(trTimeline);
        }

    } else { // Initial track creation
        headersTbody.appendChild(trHeader);
        timelineTbody.appendChild(trTimeline);
    }

    if (isChild) {
        const parentHeader = document.querySelector(`.parent-track[data-pitch="${fullPitchName}"]`);
        if (parentHeader) {
            const expandBtn = parentHeader.querySelector('.expand-btn');
            if(expandBtn) expandBtn.style.visibility = 'visible';
            if (parentHeader.classList.contains('collapsed')) {
                trHeader.style.display = 'none';
                trTimeline.style.display = 'none';
            }
        }
    } else {
        // This is a parent track, check if it has children and show the button
        const childTracks = document.querySelectorAll(`.child-track[data-pitch="${fullPitchName}"]`);
        if (childTracks.length > 0) {
            const expandBtn = trHeader.querySelector('.expand-btn');
            if (expandBtn) expandBtn.style.visibility = 'visible';
        }
    }

    const track = {
        pitch: fullPitchName,
        instrumentName: newInstrumentName,
        trHeader: trHeader,
        trTimeline: trTimeline,
        timeline: timeline,
        notes: []
    };
    MusicMaker.tracks.push(track);
};





MusicMaker.updateNoteAppearance = function(noteElement, noteData) {
    noteElement.textContent = noteData.instrumentName.substring(0, 3);

    const instrument = MusicMaker.instruments[noteData.instrumentName];
    const hue = instrument ? instrument.hue : 200;
    const saturation = instrument ? instrument.saturation : 70;

    const overallPitchIndex = MusicMaker.ALL_PITCH_NAMES.indexOf(noteData.pitch);
    const totalPitches = MusicMaker.ALL_PITCH_NAMES.length;

    const maxLightness = 90;
    const minLightness = 25;
    const lightnessRange = maxLightness - minLightness;

    // Map the pitch index (0 to totalPitches-1) to the lightness range
    const lightness = maxLightness - (overallPitchIndex / (totalPitches - 1)) * lightnessRange;

    noteElement.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    noteElement.style.borderColor = `hsl(${hue}, ${saturation}%, ${lightness - 20}%)`;
};

MusicMaker.renderNote = function(note) {
    const track = MusicMaker.tracks.find(t => t.pitch === note.pitch && t.instrumentName === note.instrumentName);
    if (!track) {
        console.warn('Track not found for note:', note);
        return;
    }
    const timeline = track.timeline;

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
            const beforeState = MusicMaker.createSnapshot();
            const clickedNote = e.target;
            if (clickedNote.classList.contains('selected')) {
                const selectedNotes = document.querySelectorAll('.note.selected');
                selectedNotes.forEach(noteElement => {
                    const noteId = noteElement.dataset.noteId;
                    const noteIndex = MusicMaker.notes.findIndex(n => n.id == noteId);
                    if (noteIndex > -1) {
                        MusicMaker.notes.splice(noteIndex, 1);
                    }
                    noteElement.remove();
                });
            } else {
                const noteId = clickedNote.dataset.noteId;
                const noteIndex = MusicMaker.notes.findIndex(n => n.id == noteId);
                if (noteIndex > -1) {
                    MusicMaker.notes.splice(noteIndex, 1);
                }
                clickedNote.remove();
            }
            MusicMaker.commitChange(beforeState);
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
            const initialPositions = selectedNotes.map(n => ({ el: n, left: n.offsetLeft, note: MusicMaker.notes.find(nt => nt.id == n.dataset.noteId) }));

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

                const beforeState = MusicMaker.createSnapshot();
                initialPositions.forEach(pos => {
                    const finalLeft = pos.el.offsetLeft;
                    pos.note.start = finalLeft / stepWidth;
                });
                MusicMaker.commitChange(beforeState);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

        } else {
            // Dragging or resizing a single note
            const initialLeft = noteElement.offsetLeft;
            const initialWidth = noteElement.offsetWidth;
            const noteObject = MusicMaker.notes.find(n => n.id == note.id);

            const isResizingRight = noteElement.style.cursor === 'e-resize';
            const isResizingLeft = noteElement.style.cursor === 'w-resize';

            function onMouseMove(moveEvent) {
                const dx = moveEvent.pageX - initialX;
                let newLeft = initialLeft;
                let newWidth = initialWidth;
                const positionGridSizePixels = 0.25 * stepWidth;
                const durationGridSizePixels = minNoteDuration * stepWidth;

                if (isResizingRight) {
                    newWidth = initialWidth + dx;
                    let snappedWidth;
                    if (minNoteDuration === 0.33) {
                        const newDuration = newWidth / stepWidth;
                        const snappedDuration = snapToTempo3Grid(newDuration);
                        snappedWidth = snappedDuration * stepWidth;
                    } else {
                        const durationGridSizePixels = minNoteDuration * stepWidth;
                        snappedWidth = Math.round(newWidth / durationGridSizePixels) * durationGridSizePixels;
                    }
                    newWidth = snappedWidth;
                } else if (isResizingLeft) {
                    newLeft = initialLeft + dx;
                    newWidth = initialWidth - dx;
                    const roundedLeft = Math.round(newLeft / positionGridSizePixels) * positionGridSizePixels;
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
                const beforeState = MusicMaker.createSnapshot();
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                if (durationTooltip) {
                    document.body.removeChild(durationTooltip);
                    durationTooltip = null;
                }

                const finalLeft = noteElement.offsetLeft;
                const finalWidth = noteElement.offsetWidth;
                const positionGridSizePixels = 0.25 * stepWidth;

                const snappedLeft = Math.round(finalLeft / positionGridSizePixels) * positionGridSizePixels;
                let snappedWidth;

                if (minNoteDuration === 0.33) {
                    const finalDuration = finalWidth / stepWidth;
                    const snappedDuration = snapToTempo3Grid(finalDuration);
                    snappedWidth = snappedDuration * stepWidth;
                } else {
                    const durationGridSizePixels = minNoteDuration * stepWidth;
                    snappedWidth = Math.round(finalWidth / durationGridSizePixels) * durationGridSizePixels;
                }

                noteElement.style.left = snappedLeft + 'px';
                noteElement.style.width = snappedWidth + 'px';

                noteObject.start = snappedLeft / stepWidth;
                noteObject.duration = snappedWidth / stepWidth;
                MusicMaker.updateSongTotalTime();
                MusicMaker.commitChange(beforeState);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    });

    timeline.appendChild(noteElement);
}

MusicMaker.renderAllNotes = function() {
    document.querySelectorAll('.note').forEach(el => el.remove());
    MusicMaker.notes.forEach(note => MusicMaker.renderNote(note));
};

MusicMaker.getTrackLayout = function() {
    const layout = {};
    const collapseState = {};
    const headersTbody = document.querySelector('#track-headers-table tbody');
    const allTracks = Array.from(headersTbody.querySelectorAll('tr'));
    allTracks.forEach(tr => {
        const pitch = tr.dataset.pitch;
        if (pitch) {
            if (!layout[pitch]) {
                layout[pitch] = [];
            }
            layout[pitch].push(tr.dataset.instrument);

            if (tr.classList.contains('parent-track')) {
                collapseState[pitch] = tr.classList.contains('collapsed');
            }
        }
    });
    return { layout, collapseState };
};

MusicMaker.comparePitches = function(pitchA, pitchB) {
    const octaveA = parseInt(pitchA.slice(-1));
    const octaveB = parseInt(pitchB.slice(-1));

    if (octaveA !== octaveB) {
        return octaveA - octaveB; // Higher octave number is higher pitch
    }

    const nameA = pitchA.slice(0, -1);
    const nameB = pitchB.slice(0, -1);

    const indexA = MusicMaker.OCTAVE_PITCH_NAMES.indexOf(nameA);
    const indexB = MusicMaker.OCTAVE_PITCH_NAMES.indexOf(nameB);

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
        const note = MusicMaker.notes.find(n => String(n.id) === el.dataset.noteId);
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
        const gridSizePixels = 0.25 * stepWidth;
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
        const gridSizePixels = 0.25 * stepWidth;
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

MusicMaker.startPasting = function(notesToPaste, beforeState) {
    const mainContent = document.getElementById('main-content');
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
        mainContent.appendChild(noteElement);
        return { el: noteElement, data: note, currentTimeline: null };
    });

    function updateGhostNotesPosition(e) {
        const allTimelines = Array.from(document.querySelectorAll('.timeline-col')).filter(tl => tl.offsetParent !== null);
        const containerRect = mainContent.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left + mainContent.scrollLeft;

        let elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
        let timelineUnderMouse = elementUnderMouse ? elementUnderMouse.closest('.timeline-col') : null;

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
        const timelineXStart = timelineRect.left - containerRect.left + mainContent.scrollLeft;
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
                const targetTimelineXStart = targetTimelineRect.left - containerRect.left + mainContent.scrollLeft;

                gn.el.style.top = (targetTimelineRect.top - containerRect.top + mainContent.scrollTop + noteTopMargin) + 'px';
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
        const beforeState = MusicMaker.createSnapshot();
        if (!isPastePositionValid) {
            return cancelPaste();
        }

        const newNotes = [];
        const allTimelines = Array.from(document.querySelectorAll('.timeline-col')).filter(tl => tl.offsetParent !== null);
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
                    pitch: ghostNote.currentTimeline.parentElement.parentElement.dataset.pitch,
                    start: newStart,
                    duration: noteData.duration
                });
            }
        });

        newNotes.forEach(note => {
            MusicMaker.notes.push(note);
            MusicMaker.renderNote(note);
        });

        MusicMaker.commitChange(beforeState);

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
    const timelines = document.querySelectorAll('.timeline-col');
    const newWidth = songTotalTime * stepWidth;
    timelines.forEach(timeline => {
        timeline.style.minWidth = newWidth + 'px';
        timeline.style.backgroundSize = stepWidth + 'px 100%';
    });
    MusicMaker.drawTimelineRuler();
}

MusicMaker.setTempo = function(tempo) {
    const tempoSlider = document.getElementById('tempo-slider');
    const tempoValue = document.getElementById('tempo-value');
    if (tempoSlider) {
        tempoSlider.value = tempo;
        tempoValue.textContent = tempo;
        // Manually trigger the input event to update minNoteDuration
        tempoSlider.dispatchEvent(new Event('input'));
    }
}



MusicMaker.drawTimelineRuler = function() {
    const ruler = document.getElementById('timeline-ruler');
    if (!ruler) return;
    ruler.innerHTML = '';

    const tempo = parseInt(document.getElementById('tempo-slider').value, 10);
    const timeUnit = 0.05 * tempo;
    if (timeUnit <= 0) return;

    const songTotalTimeInSeconds = songTotalTime * timeUnit;
    const pixelsPerSecond = stepWidth / timeUnit;

    // Determine major label spacing to avoid overlap when zoomed out
    let majorLabelStep = 1;
    if (pixelsPerSecond < 60) majorLabelStep = 2;
    if (pixelsPerSecond < 30) majorLabelStep = 5;
    if (pixelsPerSecond < 15) majorLabelStep = 10;
    if (pixelsPerSecond < 8) majorLabelStep = 20;
    if (pixelsPerSecond < 4) majorLabelStep = 60;

    // Determine marker spacing for sub-seconds when zoomed in
    let markerSubStep = 1; // How many markers per second
    if (pixelsPerSecond >= 100) markerSubStep = 2; // 0.5s
    if (pixelsPerSecond >= 200) markerSubStep = 4; // 0.25s
    if (pixelsPerSecond >= 400) markerSubStep = 8; // 0.125s

    const increment = 1 / markerSubStep;

    for (let i = 0; i < songTotalTimeInSeconds; i += increment) {
        const leftPosition = (i / timeUnit) * stepWidth;
        const marker = document.createElement('div');
        marker.className = 'time-marker';

        // Use a small tolerance for floating point modulo checks
        const isMajorTick = Math.abs(i % majorLabelStep) < 0.001 || Math.abs(i % majorLabelStep - majorLabelStep) < 0.001;
        const isSecondTick = Math.abs(i % 1) < 0.001 || Math.abs(i % 1 - 1) < 0.001;
        const isHalfTick = markerSubStep >= 2 && (Math.abs(i % 0.5) < 0.001 || Math.abs(i % 0.5 - 0.5) < 0.001);

        let labelText = null;

        if (isMajorTick) {
            marker.style.height = '100%';
            marker.style.borderLeft = '1px solid #aaa';
            labelText = Math.round(i).toString();
        } else if (isSecondTick) {
            marker.style.height = '75%';
            marker.style.borderLeft = '1px solid #888';
        } else if (isHalfTick && pixelsPerSecond >= 200) { // Add labels for 0.5s at high zoom
            marker.style.height = '60%';
            marker.style.borderLeft = '1px solid #777';
            labelText = i.toFixed(2);
        } else {
            marker.style.height = '50%';
            marker.style.borderLeft = '1px solid #666';
            // Add labels for 0.25s at very high zoom
            if (markerSubStep >= 4 && pixelsPerSecond >= 400) {
                 labelText = i.toFixed(2);
            }
        }

        // Prevent duplicate labels
        if (labelText !== null && isMajorTick && i !== Math.round(i)) {
            labelText = null;
        }
        if (labelText !== null && isSecondTick && i !== Math.round(i) && pixelsPerSecond < 200) {
            labelText = null;
        }

        if (labelText !== null) {
            const label = document.createElement('div');
            label.className = 'time-label';
            label.textContent = labelText;
            label.style.left = leftPosition + 'px';
            ruler.appendChild(label);
        }

        marker.style.left = leftPosition + 'px';
        ruler.appendChild(marker);
    }
}

MusicMaker.updateCursor = function(positionInSeconds) {
    const cursor = document.getElementById('playback-cursor');
    if (cursor) {
        const tempo = parseInt(document.getElementById('tempo-slider').value, 10);
        const timeUnit = 0.05 * tempo;
        const positionInBeats = positionInSeconds / timeUnit;
        cursor.style.left = (positionInBeats * stepWidth) + 'px';
    }
}