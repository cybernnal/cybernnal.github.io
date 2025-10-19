document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const body = document.body;

    body.classList.add('dark-mode');

    darkModeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
    });



    const minStepWidth = 2;
    const maxStepWidth = 100;

    let tracks = [];
    let baseStepWidth = 30;
    let stepWidth = baseStepWidth;
    let trackCount = 0;
    let tempo = 1;
    let zoomLevel = 25; // Default zoom level
    let trackHeight = 30; // Default track height
    let masterVolume = 1;

    let selectedNotes = [];
    let clipboard = null;
    let isCut = false;



    function clearSelection() {
        selectedNotes.forEach(noteData => {
            noteData.elements.forEach(el => el.classList.remove('selected'));
        });
        selectedNotes = [];
    }

    let isPasting = false;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            selectedNotes.forEach(noteData => {
                const parentTrack = tracks.find(t => t.notes.includes(noteData));
                if (!parentTrack) return;
                const noteIndex = parentTrack.notes.indexOf(noteData);
                if (noteIndex > -1) parentTrack.notes.splice(noteIndex, 1);
                noteData.elements.forEach(el => el.remove());
            });
            clearSelection();
            saveState();
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'c':
                    copySelection();
                    e.preventDefault();
                    break;
                case 'x':
                    copySelection();
                    isCut = true;
                    selectedNotes.forEach(n => n.elements.forEach(el => el.classList.add('ghosted')));
                    e.preventDefault();
                    break;
                case 'v':
                    if (clipboard) {
                        isPasting = true;
                        updateGhostNotes();
                        e.preventDefault();
                    }
                    break;
            }
        }
    });

    function copySelection() {
        if (selectedNotes.length === 0) return;
        tracks.forEach(t => t.notes.forEach(n => n.elements.forEach(el => el.classList.remove('ghosted'))));

        const minStart = Math.min(...selectedNotes.map(n => n.start));
        const topTrackIndex = Math.min(...selectedNotes.map(n => tracks.indexOf(n.track)));

        clipboard = selectedNotes.map(note => ({
            duration: note.duration,
            relativeStart: note.start - minStart,
            relativeTrackIndex: tracks.indexOf(note.track) - topTrackIndex
        }));
        isCut = false;
    }

    let lastMousePos = { x: 0, y: 0 };
    document.getElementById('main-content').addEventListener('mousemove', e => {
        lastMousePos = { x: e.clientX, y: e.clientY };
        if (isPasting) {
            updateGhostNotes();
        }
    });

    document.body.addEventListener('click', (e) => {
        if (isPasting) {
            e.preventDefault();
            e.stopPropagation();
            pasteSelection();
        }
    }, true);

    function updateGhostNotes() {
        document.querySelectorAll('.ghost-paste').forEach(g => g.remove());

        const targetElement = document.elementFromPoint(lastMousePos.x, lastMousePos.y);
        const timelineEl = targetElement ? targetElement.closest('.timeline-col') : null;
        if (!timelineEl) return;

        const pasteTrack = tracks.find(t => t.timeline === timelineEl);
        const rect = timelineEl.getBoundingClientRect();
        const x = lastMousePos.x - rect.left;
        const pasteStartTime = Math.round((x / stepWidth) * tempo) / tempo;

        clipboard.forEach(clipNote => {
            const targetTrackIndex = tracks.indexOf(pasteTrack) + clipNote.relativeTrackIndex;
            if (targetTrackIndex < 0 || targetTrackIndex >= tracks.length) return;

            const targetTrack = tracks[targetTrackIndex];
            const newStart = pasteStartTime + clipNote.relativeStart;

            const ghostDiv = document.createElement('div');
            ghostDiv.className = 'note ghost-paste';
            ghostDiv.style.left = `${newStart * stepWidth}px`;
            ghostDiv.style.width = `${clipNote.duration * stepWidth}px`;
            ghostDiv.style.height = `${targetTrack.timeline.clientHeight * 0.8}px`;
            ghostDiv.style.top = `${targetTrack.timeline.clientHeight * 0.1}px`;
            
            targetTrack.timeline.appendChild(ghostDiv);
        });
    }

    function pasteSelection() {
        if (!clipboard || !isPasting) return;

        const targetElement = document.elementFromPoint(lastMousePos.x, lastMousePos.y);
        const timelineEl = targetElement ? targetElement.closest('.timeline-col') : null;

        isPasting = false;
        document.querySelectorAll('.ghost-paste').forEach(g => g.remove());

        if (!timelineEl) return;

        const pasteTrack = tracks.find(t => t.timeline === timelineEl);
        const rect = timelineEl.getBoundingClientRect();
        const x = lastMousePos.x - rect.left;
        const pasteStartTime = Math.round((x / stepWidth) * tempo) / tempo;

        let collision = false;
        const proposedNotes = clipboard.map(clipNote => {
            const targetTrackIndex = tracks.indexOf(pasteTrack) + clipNote.relativeTrackIndex;
            if (targetTrackIndex < 0 || targetTrackIndex >= tracks.length) return null;
            const targetTrack = tracks[targetTrackIndex];
            const newStart = pasteStartTime + clipNote.relativeStart;
            return { start: newStart, duration: clipNote.duration, track: targetTrack };
        }).filter(p => p);

        if (proposedNotes.length !== clipboard.length) return;

        for (const p of proposedNotes) {
            for (const existing of p.track.notes) {
                if (proposedNotes.includes(existing)) continue; // Don't check against notes in the current paste group

                if (p.start < existing.start + existing.duration && p.start + p.duration > existing.start) {
                    collision = true;
                    break;
                }
            }
            if (collision) break;
        }

        if (collision) {
            alert("Cannot paste here, the notes would overlap.");
            return;
        }

        if (isCut) {
            selectedNotes.forEach(noteData => {
                const parentTrack = tracks.find(t => t.notes.includes(noteData));
                if (!parentTrack) return;
                const noteIndex = parentTrack.notes.indexOf(noteData);
                if (noteIndex > -1) parentTrack.notes.splice(noteIndex, 1);
                noteData.elements.forEach(el => el.remove());
            });
        }

        clearSelection();

        proposedNotes.forEach(noteData => {
            noteData.elements = [];
            noteData.track.notes.push(noteData);

            tracks.forEach(tr => {
                if (tr.notes === noteData.track.notes) {
                    createNoteElement(tr, noteData);
                }
            });

            selectedNotes.push(noteData);
            noteData.elements.forEach(el => el.classList.add('selected'));
        });

        if (isCut) {
            clipboard = null;
            isCut = false;
        }

        updateAllTimelineWidths();
        tracks.forEach(updateLinkButtons);
        saveState();
    }

    function updateTrackHeaderStyle(track) {
        const col = track.elem.querySelector('.instrument-col');
        if (!col) return;

        if (trackHeight < 18) { // Tiny tier
            col.classList.add('size-tiny');
            col.classList.remove('size-medium', 'size-small');
        } else if (trackHeight < 24) { // Small tier
            col.classList.remove('size-tiny');
            col.classList.add('size-small');
            col.classList.remove('size-medium');
        } else if (trackHeight < 32) { // Medium tier
            col.classList.remove('size-tiny', 'size-small');
            col.classList.add('size-medium');
        } else { // Large/Default tier
            col.classList.remove('size-tiny', 'size-small', 'size-medium');
        }
    }

    function updateTrackHeight() {
        const slider = document.getElementById('trackHeightSlider');
        trackHeight = parseInt(slider.value, 10);

        document.querySelectorAll('#track-headers-table tr, #timeline-table tr').forEach(tr => {
            tr.style.height = `${trackHeight}px`;
        });

        tracks.forEach(updateTrackHeaderStyle);
    }

    document.getElementById('addTrackBtn').addEventListener('click', () => addTrack());
    document.getElementById('exportBtn').addEventListener('click', exportTracks);
    document.getElementById('importBtn').addEventListener('click', importTracks);
    document.getElementById('tempoInput').addEventListener('input', updateTempo);
    document.getElementById('resetBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all tracks and notes?')) {
            localStorage.removeItem('musicMakerState');
            location.reload();
        }
    });

    document.getElementById('playBtn').addEventListener('click', play);

    function play() {
        const soloTrack = tracks.find(t => t.solo);
        let tracksToPlay = tracks;

        if (soloTrack) {
            tracksToPlay = [soloTrack];
        }

        tracksToPlay.forEach(track => {
            if (!track.muted) {
                track.notes.forEach(note => {
                    console.log(`Playing note: ${note.start}, ${note.duration}, ${track.name}, volume: ${track.volume * masterVolume}`);
                });
            }
        });
    }

    function saveState() {
        const state = {
            tempo: tempo,
            tracks: tracks.map(track => ({
                name: track.name,
                color: track.color,
                groupId: track.groupId,
                isLinked: track.isLinked,
                muted: track.muted,
                solo: track.solo,
                volume: track.volume,
                timelineMinWidth: track.timeline.style.minWidth,
                notes: track.isLinked ? null : track.notes.map(note => ({
                    start: note.start,
                    duration: note.duration
                }))
            }))
        };
        localStorage.setItem('musicMakerState', JSON.stringify(state));
    }

    function loadState() {
        updateTrackHeight();
        const savedStateJSON = localStorage.getItem('musicMakerState');

        if (!savedStateJSON) {
            addTrack(); // Creates and saves a default track
        } else {
            const savedState = JSON.parse(savedStateJSON);

            // Clear default state
            document.querySelector('#track-headers-table tbody').innerHTML = '';
            document.querySelector('#timeline-table tbody').innerHTML = '';
            tracks = [];
            trackCount = 0;

            document.getElementById('tempoInput').value = savedState.tempo || 1;
            tempo = savedState.tempo || 1;

            const parentTrackMap = new Map();

            savedState.tracks.forEach(savedTrack => {
                let trackToProcess;

                if (savedTrack.isLinked) {
                    const parent = parentTrackMap.get(savedTrack.groupId);
                    if (!parent) return;

                    const originalIndex = tracks.indexOf(parent);
                    trackToProcess = addTrack(parent, true, true);
                    trackToProcess.groupId = parent.groupId;

                    tracks.splice(tracks.indexOf(trackToProcess), 1);
                    tracks.splice(originalIndex + 1, 0, trackToProcess);

                    trackToProcess.isLinked = true;
                    trackToProcess.notes = parent.notes;
                    trackToProcess.notes.forEach(note => createNoteElement(trackToProcess, note));
                } else {
                    trackToProcess = addTrack(null, false, true);
                    parentTrackMap.set(savedTrack.groupId, trackToProcess);

                    savedTrack.notes.forEach(savedNote => {
                        const note = { start: savedNote.start, duration: savedNote.duration, elements: [], track: trackToProcess };
                        trackToProcess.notes.push(note);
                        createNoteElement(trackToProcess, note);
                    });
                }

                trackToProcess.name = savedTrack.name;
                trackToProcess.input.value = savedTrack.name;
                trackToProcess.color = savedTrack.color;
                trackToProcess.groupId = savedTrack.groupId;
                trackToProcess.muted = savedTrack.muted;
                trackToProcess.solo = savedTrack.solo;
                trackToProcess.volume = savedTrack.volume;
                if (savedTrack.timelineMinWidth) {
                    trackToProcess.timeline.style.minWidth = savedTrack.timelineMinWidth;
                }
            });





            const headersTbody = document.querySelector('#track-headers-table tbody');
            if (!headersTbody) {
                const newHeadersTbody = document.createElement('tbody');
                document.querySelector('#track-headers-table').appendChild(newHeadersTbody);
                tracks.forEach(t => newHeadersTbody.appendChild(t.elem));
            } else {
                tracks.forEach(t => headersTbody.appendChild(t.elem));
            }

                        tracks.forEach(updateLinkButtons);
            updateTrackLabels();
            updateTrackStyles();
            updateTrackColors();
            redrawAllNotes();
        }

        // After loading or creating the initial track, set the default zoom without saving state.
        const slider = document.getElementById('zoomSlider');
        slider.value = 15;
        zoomLevel = 15;

        stepWidth = minStepWidth + (zoomLevel / 100) * (maxStepWidth - minStepWidth);

        redrawAllNotes();
        updateTimelineGrids();
        updateAllTimelineWidths();
    }


    function updateTempo() {
        let newTempo = parseFloat(document.getElementById('tempoInput').value);
        if (!newTempo || newTempo <= 0) newTempo = 1;

        const oldTempo = tempo;
        const incompatibleNotes = [];
        const epsilon = 0.00001; // To handle floating point inaccuracies

        // No need to check if new tempo is a multiple of the old one
        if (newTempo > oldTempo && newTempo % oldTempo === 0) {
            tempo = newTempo;
            redrawAllNotes();
            saveState();
            return;
        }

        tracks.forEach(track => {
            track.notes.forEach(note => {
                const startCheck = note.start * newTempo;
                const durationCheck = note.duration * newTempo;
                const startIncompatible = Math.abs(startCheck - Math.round(startCheck)) > epsilon;
                const durationIncompatible = Math.abs(durationCheck - Math.round(durationCheck)) > epsilon;
                if (startIncompatible || durationIncompatible) {
                    incompatibleNotes.push({note, startIncompatible, durationIncompatible});
                }
            });
        });

        if (incompatibleNotes.length > 0) {
            const choice = prompt("Some notes are not aligned with the new tempo. Choose an action:\n'u' - round up\n'd' - round down\n'k' - keep as is");

            if (choice === null) {
                document.getElementById('tempoInput').value = oldTempo;
                return; // Abort tempo change
            }

            const processedChoice = choice.toLowerCase();

            switch (processedChoice) {
                case 'u':
                    incompatibleNotes.forEach(({note, startIncompatible, durationIncompatible}) => {
                        if (startIncompatible) {
                            note.start = Math.ceil(note.start * newTempo) / newTempo;
                        }
                        if (durationIncompatible) {
                            note.duration = Math.ceil(note.duration * newTempo) / newTempo;
                        }
                    });
                    break;
                case 'd':
                    incompatibleNotes.forEach(({note, startIncompatible, durationIncompatible}) => {
                        if (startIncompatible) {
                            note.start = Math.floor(note.start * newTempo) / newTempo;
                        }
                        if (durationIncompatible) {
                            let newDuration = Math.floor(note.duration * newTempo) / newTempo;
                            if (newDuration < 0.01) newDuration = 0.01;
                            note.duration = newDuration;
                        }
                    });
                    break;
                case 'k':
                    // Do nothing, just apply the new tempo
                    break;
                default:
                    document.getElementById('tempoInput').value = oldTempo;
                    return; // Abort on invalid input
            }
        }

        tempo = newTempo;
        redrawAllNotes();
        updateTimelineGrids();
        saveState();
    }

    function redrawAllNotes() {
        tracks.forEach(track => {
            track.notes.forEach(note => {
                note.elements.forEach(el => {
                    el.style.left = (note.start * stepWidth) + 'px';
                    el.style.width = (note.duration * stepWidth) + 'px';
                });
            });
        });
    }

    function addTrack(sourceTrack = null, skipNoteCreation = false, suppressSave = false) {
        trackCount++;
        let track = { name: '', notes: [], isLinked: false, color: getNextColor(), groupId: null, muted: false, solo: false, volume: 1 };
        if (sourceTrack) {
            track.name = sourceTrack.name;
            track.groupId = sourceTrack.groupId;
            track.color = sourceTrack.color;
            if (!skipNoteCreation) {
                track.notes = sourceTrack.notes.map(n => ({ start: n.start, duration: n.duration, elements: [] }));
            }
        } else {
            track.groupId = Date.now() + Math.random();
        }
        tracks.push(track);
        createTrackRow(track);
        if (sourceTrack && !skipNoteCreation) {
            track.notes.forEach(note => {
                note.track = track; // Ensure new notes point to the new track
                createNoteElement(track, note);
            });
        }

        updateTrackLabels();
        updateTrackStyles();
        updateTrackColors();
        updateTrackHeaderStyle(track);
        if (!suppressSave) saveState();
        return track;
    }



    function updateLinkButtons(track) {
        if (track.isLinked) {
            track.linkBtn.style.display = 'none';
            track.unlinkBtn.style.display = 'inline-block';
        } else {
            track.linkBtn.style.display = 'inline-block';
            track.unlinkBtn.style.display = 'none';
        }
    }

    function createTrackRow(track) {
        let headersTbody = document.querySelector('#track-headers-table tbody');
        let timelineTbody = document.querySelector('#timeline-table tbody');

        let trHeader = document.createElement('tr');
        let tdInstrument = document.createElement('td');
        let instrCol = document.createElement('div');
        instrCol.className = 'instrument-col';

        let dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.textContent = '☰';
        dragHandle.addEventListener('mousedown', dragStart);
        instrCol.appendChild(dragHandle);

        let label = document.createElement('span');
        label.className = 'track-label';
        label.textContent = 'Track ' + trackCount;
        let input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Instrument name';
        input.value = track.name;
        input.addEventListener('input', () => { 
            track.name = input.value; 
            saveState();
        });

        let trackLabelInputContainer = document.createElement('div');
        trackLabelInputContainer.className = 'track-label-input-container';
        trackLabelInputContainer.appendChild(label);
        trackLabelInputContainer.appendChild(input);

        let linkBtn = document.createElement('button');
        linkBtn.textContent = '🔗';
        linkBtn.className = 'link-btn';
        linkBtn.title = 'Link';
        let unlinkBtn = document.createElement('button');
        unlinkBtn.textContent = '💔';
        unlinkBtn.className = 'unlink-btn';
        unlinkBtn.title = 'Unlink';
        track.linkBtn = linkBtn;
        track.unlinkBtn = unlinkBtn;

        updateLinkButtons(track);
        let dupBtn = document.createElement('button');
        dupBtn.textContent = '⧉';
        dupBtn.className = 'dup-btn';
        dupBtn.title = 'Duplicate';
        let delBtn = document.createElement('button');
        delBtn.textContent = '🗑️';
        delBtn.className = 'del-btn';
        delBtn.title = 'Delete';

        let muteBtn = document.createElement('button');
        muteBtn.textContent = '🔊';
        muteBtn.className = 'mute-btn';
        muteBtn.title = 'Mute';

        let soloBtn = document.createElement('button');
        soloBtn.textContent = '▶️';
        soloBtn.className = 'solo-btn';
        soloBtn.title = 'Solo';

        let volumeSlider = document.createElement('input');
        volumeSlider.type = 'range';
        volumeSlider.min = 0;
        volumeSlider.max = 1;
        volumeSlider.step = 0.01;
        volumeSlider.value = 1;
        volumeSlider.className = 'volume-slider';

        linkBtn.addEventListener('mouseover', showTooltip);
        linkBtn.addEventListener('mouseout', hideTooltip);
        unlinkBtn.addEventListener('mouseover', showTooltip);
        unlinkBtn.addEventListener('mouseout', hideTooltip);
        dupBtn.addEventListener('mouseover', showTooltip);
        dupBtn.addEventListener('mouseout', hideTooltip);
        delBtn.addEventListener('mouseover', showTooltip);
        delBtn.addEventListener('mouseout', hideTooltip);
        muteBtn.addEventListener('mouseover', showTooltip);
        muteBtn.addEventListener('mouseout', hideTooltip);
        soloBtn.addEventListener('mouseover', showTooltip);
        soloBtn.addEventListener('mouseout', hideTooltip);

        instrCol.appendChild(trackLabelInputContainer);
        instrCol.appendChild(linkBtn);
        instrCol.appendChild(unlinkBtn);
        instrCol.appendChild(dupBtn);
        instrCol.appendChild(delBtn);
        instrCol.appendChild(muteBtn);
        instrCol.appendChild(soloBtn);
        instrCol.appendChild(volumeSlider);
        tdInstrument.appendChild(instrCol);
        trHeader.appendChild(tdInstrument);

        let trTimeline = document.createElement('tr');
        let tdTimeline = document.createElement('td');
        let timeline = document.createElement('div');
        timeline.className = 'timeline-col';
        timeline.style.height = `${trackHeight}px`;
        timeline.style.minWidth = '1000px'; // initial width
        tdTimeline.appendChild(timeline);
        trTimeline.appendChild(tdTimeline);

        headersTbody.appendChild(trHeader);
        timelineTbody.appendChild(trTimeline);

        track.elem = trHeader; // Keep a reference to the header row for dragging
        track.timelineElem = trTimeline; // Keep a reference to the timeline row
        track.timeline = timeline;
        track.input = input;
        track.label = label;

        dupBtn.addEventListener('click', () => addTrack(track));
        delBtn.addEventListener('click', () => {
            if (!track.isLinked) {
                const myIndex = tracks.indexOf(track);
                const childrenToUnlink = [];
                for (let i = myIndex + 1; i < tracks.length; i++) {
                    const nextTrack = tracks[i];
                    if (nextTrack.notes === track.notes && nextTrack.isLinked) {
                        childrenToUnlink.push(nextTrack);
                    } else {
                        break;
                    }
                }

                if (childrenToUnlink.length > 0) {
                    const firstChild = childrenToUnlink[0];
                    firstChild.isLinked = false;
                    childrenToUnlink.slice(1).forEach(child => {
                        child.notes = firstChild.notes;
                    });
                    updateLinkButtons(firstChild);
                }
            }

            let idx = tracks.indexOf(track);
            if (idx !== -1) {
                tracks.splice(idx, 1);
                track.elem.remove();
                track.timelineElem.remove();
                updateTrackLabels();
                updateTrackStyles();
                saveState();
            }
        });
        linkBtn.addEventListener('click', () => {
            let originalIndex = tracks.indexOf(track);
            let newTrack = addTrack(track, true, true);
            newTrack.groupId = track.groupId;

            tracks.splice(tracks.indexOf(newTrack), 1);
            tracks.splice(originalIndex + 1, 0, newTrack);

            newTrack.isLinked = true;
            newTrack.color = track.color;
            newTrack.notes = track.notes;

            updateLinkButtons(track);
            updateLinkButtons(newTrack);

            let headersTbody = document.querySelector('#track-headers-table tbody');
            let timelineTbody = document.querySelector('#timeline-table tbody');
            if (!timelineTbody) {
                timelineTbody = document.createElement('tbody');
                document.querySelector('#timeline-table').appendChild(timelineTbody);
            }
            tracks.forEach(t => {
                headersTbody.appendChild(t.elem);
                timelineTbody.appendChild(t.timelineElem);
            });

            updateTrackLabels();
            updateTrackStyles();
            updateTrackColors();
            saveState();
        });

        unlinkBtn.addEventListener('click', () => {
            const notesRef = track.notes;
            const linkedGroup = tracks.filter(t => t.notes === notesRef);
            const lastTrackOfGroup = linkedGroup[linkedGroup.length - 1];

                        track.isLinked = false;
                        track.notes = track.notes.map(n => ({ ...n, elements: [], track: track }));
                        track.groupId = Date.now() + Math.random();        
                        updateLinkButtons(track);        
            track.timeline.innerHTML = '';
            track.notes.forEach(note => createNoteElement(track, note));

            const currentIndex = tracks.indexOf(track);
            tracks.splice(currentIndex, 1);
            const newIndex = tracks.indexOf(lastTrackOfGroup);
            tracks.splice(newIndex + 1, 0, track);

            let headersTbody = document.querySelector('#track-headers-table tbody');
            let timelineTbody = document.querySelector('#timeline-table tbody');
            if (!timelineTbody) {
                timelineTbody = document.createElement('tbody');
                document.querySelector('#timeline-table').appendChild(timelineTbody);
            }
            tracks.forEach(t => {
                headersTbody.appendChild(t.elem);
                timelineTbody.appendChild(t.timelineElem);
            });

            updateTrackLabels();
            updateTrackStyles();
            updateTrackColors();
            saveState();
        });



        muteBtn.addEventListener('click', () => {
            track.muted = !track.muted;
            muteBtn.textContent = track.muted ? '🔇' : '🔊';
            muteBtn.title = track.muted ? 'Unmute' : 'Mute';
            muteBtn.style.backgroundColor = track.muted ? '#ffc107' : '';
            saveState();
        });


    }

    function updateTrackLabels() {
        tracks.forEach((track, i) => {
            track.label.textContent = 'Track ' + (i+1);
        });
    }

    function updateSelectionHandle() {
        // TODO: Implement selection handle UI update
    }



    function createNoteElement(track, note) {
        let tl = track.timeline;
        let div = document.createElement('div');
        div.className = 'note';
        div.style.backgroundColor = track.color;
        div.style.left = (note.start * stepWidth) + 'px';
        div.style.width = (note.duration * stepWidth) + 'px';
        div.noteData = note;
        div.setAttribute('draggable', false);

        div.addEventListener('mousedown', onMouseDownNote);
        div.addEventListener('dragstart', (e) => { e.preventDefault(); return false; });

        div.addEventListener('click', (e) => {
            if (isDraggingOrResizing) return;
            e.stopPropagation(); // Prevent timeline click

            const isSelected = selectedNotes.includes(note);

            if (!e.shiftKey && !isSelected) {
                clearSelection();
            }

            if (isSelected && e.shiftKey) {
                // Deselect if shift-clicking an already selected note
                const index = selectedNotes.indexOf(note);
                selectedNotes.splice(index, 1);
                note.elements.forEach(el => el.classList.remove('selected'));
            } else if (!isSelected) {
                // Select the note
                selectedNotes.push(note);
                note.elements.forEach(el => el.classList.add('selected'));
            }
            updateSelectionHandle();
        });

        tl.appendChild(div);
        note.elements = note.elements || [];
        note.elements.push(div);
        return div;
    }

    function updateTrackStyles() {
        tracks.forEach(track => {
            if (track.elem) {
                if (track.isLinked) {
                    track.elem.classList.add('indented');
                } else {
                    track.elem.classList.remove('indented');
                }
            }
        });
    }

    const pastelColors = [
        'hsl(24, 100%, 85%)', 'hsl(43, 100%, 85%)', 'hsl(62, 100%, 85%)',
        'hsl(81, 100%, 85%)', 'hsl(100, 100%, 85%)', 'hsl(119, 100%, 85%)',
        'hsl(138, 100%, 85%)', 'hsl(157, 100%, 85%)', 'hsl(176, 100%, 85%)',
        'hsl(195, 100%, 85%)', 'hsl(214, 100%, 85%)', 'hsl(233, 100%, 85%)',
        'hsl(252, 100%, 85%)', 'hsl(271, 100%, 85%)', 'hsl(290, 100%, 85%)',
        'hsl(309, 100%, 85%)', 'hsl(328, 100%, 85%)', 'hsl(347, 100%, 85%)'
    ];
    let colorIndex = 0;

    const hslToHex = (h, s, l) => {
      l /= 100;
      const a = s * Math.min(l, 1 - l) / 100;
      const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };

    function getNextColor() {
        const colorHsl = pastelColors[colorIndex];
        const [h, s, l] = colorHsl.match(/\d+/g).map(Number);
        colorIndex = (colorIndex + 1) % pastelColors.length;
        return hslToHex(h, s, l);
    }

    const colorPaletteBtn = document.getElementById('color-palette-btn');
    const colorPaletteDropdown = document.getElementById('color-palette-dropdown');

    colorPaletteBtn.addEventListener('click', () => {
        colorPaletteDropdown.style.display = colorPaletteDropdown.style.display === 'block' ? 'none' : 'block';
    });

    colorPaletteDropdown.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-swatch')) {
            const color = e.target.dataset.color;
            changeTrackColors(color);
            colorPaletteDropdown.style.display = 'none';
        }
    });

    document.getElementById('custom-color-btn').addEventListener('click', () => {
        const colorPickerWrapper = document.getElementById('color-picker-wrapper');
        colorPickerWrapper.style.display = colorPickerWrapper.style.display === 'block' ? 'none' : 'block';
    });

    document.getElementById('confirm-color-btn').addEventListener('click', () => {
        const colorPicker = document.getElementById('color-picker');
        const color = colorPicker.value;
        changeTrackColors(color);
        document.getElementById('color-picker-wrapper').style.display = 'none';
        colorPaletteDropdown.style.display = 'none';
    });

    function changeTrackColors(color) {
        if (selectedNotes.length > 0) {
            const tracksToUpdate = new Set();
            selectedNotes.forEach(note => {
                tracksToUpdate.add(note.track);
            });

            tracksToUpdate.forEach(track => {
                track.color = color;
            });

            updateTrackColors();
            saveState();
        }
        document.getElementById('color-palette-btn').style.backgroundColor = color;

        document.querySelectorAll('.color-swatch').forEach(swatch => {
            if (swatch.dataset.color === color) {
                swatch.classList.add('selected-color');
            } else {
                swatch.classList.remove('selected-color');
            }
        });
    }

    function updateTrackColors() {
        const colorGroups = {};
        tracks.forEach(track => {
            if (!colorGroups[track.groupId]) {
                colorGroups[track.groupId] = [];
            }
            colorGroups[track.groupId].push(track);
        });

        for (let key in colorGroups) {
            const group = colorGroups[key];
            const parentColor = group[0].color;
            group.forEach(track => {
                track.color = parentColor;
                if (track.elem) {
                    const instrumentTd = track.elem.querySelector('td');
                    if (instrumentTd) {
                        instrumentTd.style.backgroundColor = track.color;
                    }
                    track.notes.forEach(note => {
                        note.elements.forEach(noteEl => {
                            if (noteEl) {
                                noteEl.style.backgroundColor = track.color;
                            }
                        });
                    });
                }
            });
        }
        if (tracks.length > 0) {
            document.getElementById('color-palette-btn').style.backgroundColor = tracks[0].color;
        }
    }

    function updateTimelineWidth(track) {
        if (!track.notes || track.notes.length === 0) {
            track.timeline.style.minWidth = '1000px'; // Default width
            return;
        }
        const maxEnd = Math.max(0, ...track.notes.map(n => n.start + n.duration));
        track.timeline.style.minWidth = (maxEnd * stepWidth + 200) + 'px';
    }

    function updateAllTimelineWidths() {
        tracks.forEach(updateTimelineWidth);
    }

    function updateTimelineGrids() {
        const gridWidth = stepWidth / tempo;
        tracks.forEach(track => {
            track.timeline.style.backgroundSize = `${gridWidth}px 100%, 100% 21px`;
        });
    }

    function updateZoom() {
        const slider = document.getElementById('zoomSlider');
        zoomLevel = parseInt(slider.value, 10);

        stepWidth = minStepWidth + (zoomLevel / 100) * (maxStepWidth - minStepWidth);

        redrawAllNotes();
        updateTimelineGrids();
        updateAllTimelineWidths();
    }

    document.getElementById('zoomSlider').addEventListener('input', updateZoom);
    document.getElementById('trackHeightSlider').addEventListener('input', updateTrackHeight);
    document.getElementById('masterVolumeSlider').addEventListener('input', (e) => {
        masterVolume = parseFloat(e.target.value);
        saveState();
    });




    let currentlyDragging = null;
    let draggingGroup = [];
    let isDraggingOrResizing = false;

    function dragStart(e) {
        isDraggingOrResizing = true;
        document.body.classList.add('dragging');
        const startTr = this.closest('tr');
        const startTrack = tracks.find(t => t.elem === startTr);
        if (!startTrack) return;

        // Determine the parent of the group
        let parentTrack;
        if (startTrack.isLinked) {
            const notesRef = startTrack.notes;
            parentTrack = tracks.find(t => !t.isLinked && t.notes === notesRef);
        } else {
            parentTrack = startTrack;
        }

        if (!parentTrack) return;

        // The drag is anchored to the parent
        currentlyDragging = parentTrack.elem;
        draggingGroup = [parentTrack.elem];

        // Find all children of that parent
        const startIndex = tracks.indexOf(parentTrack);
        for (let i = startIndex + 1; i < tracks.length; i++) {
            const nextTrack = tracks[i];
            if (nextTrack.isLinked && nextTrack.notes === parentTrack.notes) {
                draggingGroup.push(nextTrack.elem);
            } else {
                break;
            }
        }

        // Apply styling to the whole group
        draggingGroup.forEach(tr => {
            tr.style.opacity = 0.5;
            tr.classList.add('dragging');
        });

        document.addEventListener('mousemove', dragOver);
        document.addEventListener('mouseup', dragEnd);
    }

    function dragOver(e) {
        if (!currentlyDragging) return;
        const tbody = currentlyDragging.parentElement;
        // Find the next row that isn't part of the group we're dragging
        const allRows = [...tbody.querySelectorAll('tr:not(.dragging)')];
        let nextRow = allRows.find(row => {
            const rowRect = row.getBoundingClientRect();
            return e.clientY < rowRect.top + rowRect.height / 2;
        });

        // If we are about to drop inside a linked group, find the parent of that group and drop before it.
        if (nextRow) {
            const nextTrack = tracks.find(t => t.elem === nextRow);
            if (nextTrack && nextTrack.isLinked) {
                const notesRef = nextTrack.notes;
                // Find the parent of this group.
                const parentTrack = tracks.find(t => !t.isLinked && t.notes === notesRef);
                if (parentTrack) {
                    nextRow = parentTrack.elem;
                }
            }
        }

        // Move the entire group
        if (nextRow) {
            draggingGroup.forEach(tr => tbody.insertBefore(tr, nextRow));
        } else {
            draggingGroup.forEach(tr => tbody.appendChild(tr));
        }
    }

    function dragEnd() {
        if (!currentlyDragging) return;

        document.body.classList.remove('dragging');

        // Reset styles for the group
        draggingGroup.forEach(tr => {
            tr.style.opacity = 1;
            tr.classList.remove('dragging');
        });

        const headersTbody = document.querySelector('#track-headers-table tbody');
        const newOrderedElems = [...headersTbody.querySelectorAll('tr')];
        const newTracks = newOrderedElems.map(elem => {
            return tracks.find(t => t.elem === elem);
        });
        tracks = newTracks;

        // Reorder the timeline table to match the headers table
        const timelineTbody = document.querySelector('#timeline-table tbody');
        if (timelineTbody) {
            tracks.forEach(track => {
                timelineTbody.appendChild(track.timelineElem);
            });
        } else {
            const newTimelineTbody = document.createElement('tbody');
            tracks.forEach(track => {
                newTimelineTbody.appendChild(track.timelineElem);
            });
            document.querySelector('#timeline-table').appendChild(newTimelineTbody);
        }

        document.removeEventListener('mousemove', dragOver);
        document.removeEventListener('mouseup', dragEnd);
        currentlyDragging = null;
        draggingGroup = [];

        // Update labels to reflect new order
        updateTrackLabels();
        updateTrackColors();
        
        // Use a timeout to reset the flag after the click event has had time to fire and be ignored.
        setTimeout(() => { 
            isDraggingOrResizing = false; 
            saveState();
        }, 0);
    }

    let activeNote = null;
    let activeTrack = null;
    let initialX = 0;
    let initialLeft = 0;
    let initialWidth = 0;
    let isGroupDrag = false;

    function onMouseDownNote(e) {
        if (e.button !== 0) return;

        const noteElement = this;
        const rect = noteElement.getBoundingClientRect();
        const clickX = e.clientX - rect.left;

        if (clickX < 10) {
            onMouseDownLeftHandle.call(this, e);
        } else if (clickX > rect.width - 10) {
            onMouseDownRightHandle.call(this, e);
        } else {
            // Allow left-click dragging in both Edit and Select modes.
            e.preventDefault();
            isDraggingOrResizing = true;
            activeNote = this;
            activeTrack = tracks.find(t => t.timeline === this.parentElement);
            initialX = e.clientX;
            initialLeft = this.offsetLeft;

            const noteData = activeNote.noteData;
            isGroupDrag = selectedNotes.length > 1 && selectedNotes.includes(noteData);

            const notesToPrep = isGroupDrag ? selectedNotes : [noteData];
            notesToPrep.forEach(note => {
                note.originalStart = note.start;
            });

            document.addEventListener('mousemove', onMouseMoveNote);
            document.addEventListener('mouseup', onMouseUpNote);
        }
    }

    function onMouseMoveNote(e) {
        if (!activeNote) return;
        e.preventDefault();

        let dx = e.clientX - initialX;
        let newLeft = initialLeft + dx;
        let newStart = Math.round(newLeft / stepWidth * tempo) / tempo;
        if (newStart < 0) newStart = 0;

        const delta = newStart - activeNote.noteData.originalStart;

        const notesToMove = isGroupDrag ? selectedNotes : [activeNote.noteData];

        notesToMove.forEach(note => {
            const proposedStart = note.originalStart + delta;
            note.elements.forEach(el => {
                el.style.left = (proposedStart * stepWidth) + 'px';
            });
        });
    }

    function onMouseUpNote(e) {
        if (!activeNote) return;

        const dx = e.clientX - initialX;
        const newLeft = initialLeft + dx;
        let newStart = Math.round(newLeft / stepWidth * tempo) / tempo;
        if (newStart < 0) newStart = 0;

        const delta = newStart - activeNote.noteData.originalStart;
        const notesToMove = isGroupDrag ? selectedNotes : [activeNote.noteData];
        let collision = false;

        // Collision detection for the entire block
        for (const movedNote of notesToMove) {
            const proposedStart = movedNote.originalStart + delta;
            if (proposedStart < 0) {
                collision = true;
                break;
            }
            const track = tracks.find(t => t.notes.includes(movedNote));
            if (!track) continue;

            for (const existingNote of track.notes) {
                // Only check against notes that are NOT part of the dragged selection
                if (!notesToMove.includes(existingNote)) {
                    if (proposedStart < existingNote.start + existingNote.duration && proposedStart + movedNote.duration > existingNote.start) {
                        collision = true;
                        break;
                    }
                }
            }
            if (collision) break;
        }

        // Finalize positions or revert
        notesToMove.forEach(note => {
            if (collision) {
                // Snap back to original position
                note.start = note.originalStart;
            } else {
                // Commit new position
                note.start = note.originalStart + delta;
            }
            // Update visuals and clean up
            note.elements.forEach(el => {
                el.style.left = (note.start * stepWidth) + 'px';
            });
            delete note.originalStart;
        });

        if (!collision) {
            updateAllTimelineWidths();
            saveState();
        }

        document.removeEventListener('mousemove', onMouseMoveNote);
        document.removeEventListener('mouseup', onMouseUpNote);
        activeNote = null;
        activeTrack = null;
        isGroupDrag = false;
        setTimeout(() => { 
            isDraggingOrResizing = false; 
        }, 0);
    }

    function onMouseDownLeftHandle(e) {
        if (e.button !== 0) return;
        isDraggingOrResizing = true;
        activeNote = this;
        activeTrack = tracks.find(t => t.timeline === this.parentElement);
        initialX = e.clientX;
        initialLeft = activeNote.offsetLeft;
        initialWidth = activeNote.offsetWidth;
        let tooltip = document.getElementById('duration-tooltip');
        tooltip.style.display = 'block';
        document.addEventListener('mousemove', onMouseMoveLeftHandle);
        document.addEventListener('mouseup', onMouseUpLeftHandle);
    }

    function onMouseMoveLeftHandle(e) {
        if (!activeNote) return;

        // Auto-expand timeline
        const timeline = activeTrack.timeline;
        const timelineRect = timeline.getBoundingClientRect();
        if (e.clientX > timelineRect.right - 200) {
            timeline.style.minWidth = (timeline.offsetWidth + window.innerWidth) + 'px';
        }

        let dx = e.clientX - initialX;
        let newLeft = initialLeft + dx;
        let newWidth = initialWidth - dx;
        let newStart = Math.round(newLeft / (stepWidth / tempo)) / tempo;
        let newDuration = Math.round(newWidth / (stepWidth / tempo)) / tempo;

        // Find the closest note to the left
        let maxPrevEnd = -Infinity;
        for (const n of activeTrack.notes) {
            if (n !== activeNote.noteData && n.start < activeNote.noteData.start && n.start + n.duration > maxPrevEnd) {
                maxPrevEnd = n.start + n.duration;
            }
        }

        // If we are resizing past the closest note, snap to it.
        if (newStart < maxPrevEnd) {
            newStart = maxPrevEnd;
            newDuration = (activeNote.noteData.start + activeNote.noteData.duration) - newStart;
            newLeft = newStart * stepWidth;
            newWidth = newDuration * stepWidth;
        }

        // Update all linked note elements' positions and widths simultaneously
        activeNote.noteData.elements.forEach(el => {
            el.style.left = newLeft + 'px';
            el.style.width = newWidth + 'px';
        });

        let tooltip = document.getElementById('duration-tooltip');
        tooltip.textContent = newDuration.toFixed(2);
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
    }

    function onMouseUpLeftHandle(e) {
        if (!activeNote) return;
        let newLeft = activeNote.offsetLeft;
        let newWidth = activeNote.offsetWidth;
        let newStart = Math.round(newLeft / stepWidth * tempo) / tempo;
        let newDuration = Math.round(newWidth / stepWidth * tempo) / tempo;
        if (newStart < 0) newStart = 0;
        let min_duration = 1/tempo;
        if (newDuration < min_duration) newDuration = min_duration;

        const originalEnd = activeNote.noteData.start + activeNote.noteData.duration;

        // Collision detection
        for (let i = 0; i < activeTrack.notes.length; i++) {
            let n = activeTrack.notes[i];
            if (n !== activeNote.noteData && newStart < n.start + n.duration && newStart + newDuration > n.start) {
                // Collision detected, revert to original size and position
                activeNote.noteData.elements.forEach(el => {
                    el.style.left = (activeNote.noteData.start * stepWidth) + 'px';
                    el.style.width = (activeNote.noteData.duration * stepWidth) + 'px';
                });
                let tooltip = document.getElementById('duration-tooltip');
                tooltip.style.display = 'none';
                document.removeEventListener('mousemove', onMouseMoveLeftHandle);
                document.removeEventListener('mouseup', onMouseUpLeftHandle);
                activeNote = null;
                activeTrack = null;
                setTimeout(() => { 
                    isDraggingOrResizing = false; 
                }, 0);
                return;
            }
        }

        activeNote.noteData.start = newStart;
        activeNote.noteData.duration = newDuration;

        // Update all linked note elements
        activeNote.noteData.elements.forEach(el => {
            el.style.left = (newStart * stepWidth) + 'px';
            el.style.width = (newDuration * stepWidth) + 'px';
        });

        // Extend timeline width if needed
        updateTimelineWidth(activeTrack);

        let tooltip = document.getElementById('duration-tooltip');
        tooltip.style.display = 'none';

        document.removeEventListener('mousemove', onMouseMoveLeftHandle);
        document.removeEventListener('mouseup', onMouseUpLeftHandle);
        activeNote = null;
        activeTrack = null;
        setTimeout(() => { 
            isDraggingOrResizing = false; 
            saveState();
        }, 0);
    }

    function onMouseDownRightHandle(e) {
        if (e.button !== 0) return;
        isDraggingOrResizing = true;
        activeNote = this;
        activeTrack = tracks.find(t => t.timeline === this.parentElement);
        initialX = e.clientX;
        initialWidth = activeNote.offsetWidth;
        let tooltip = document.getElementById('duration-tooltip');
        tooltip.style.display = 'block';
        document.addEventListener('mousemove', onMouseMoveRightHandle);
        document.addEventListener('mouseup', onMouseUpRightHandle);
    }

    function onMouseMoveRightHandle(e) {
        if (!activeNote) return;

        // Auto-expand timeline
        const timeline = activeTrack.timeline;
        const timelineRect = timeline.getBoundingClientRect();
        if (e.clientX > timelineRect.right - 200) {
            timeline.style.minWidth = (timeline.offsetWidth + window.innerWidth) + 'px';
        }

        let dx = e.clientX - initialX;
        let newWidth = initialWidth + dx;
        let newDuration = Math.round(newWidth / (stepWidth / tempo)) / tempo;

        // Find the closest note to the right
        let minNextStart = Infinity;
        for (const n of activeTrack.notes) {
            if (n !== activeNote.noteData && n.start > activeNote.noteData.start && n.start < minNextStart) {
                minNextStart = n.start;
            }
        }

        // If we are resizing past the closest note, snap to it.
        if (activeNote.noteData.start + newDuration > minNextStart) {
            newDuration = minNextStart - activeNote.noteData.start;
            newWidth = newDuration * stepWidth;
        }

        // Update all linked note elements' widths simultaneously
        activeNote.noteData.elements.forEach(el => {
            el.style.width = newWidth + 'px';
        });

        let tooltip = document.getElementById('duration-tooltip');
        tooltip.textContent = newDuration.toFixed(2);
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
    }

    function onMouseUpRightHandle(e) {
        if (!activeNote) return;
        let newWidth = activeNote.offsetWidth;
        let newDuration = Math.round(newWidth / stepWidth * tempo) / tempo;
        let min_duration = 1/tempo;
        if (newDuration < min_duration) newDuration = min_duration;

        // Collision detection
        for (let i = 0; i < activeTrack.notes.length; i++) {
            let n = activeTrack.notes[i];
            if (n !== activeNote.noteData && activeNote.noteData.start < n.start + n.duration && activeNote.noteData.start + newDuration > n.start) {
                // Collision detected, revert to original size
                activeNote.noteData.elements.forEach(el => {
                    el.style.width = (activeNote.noteData.duration * stepWidth) + 'px';
                });
                let tooltip = document.getElementById('duration-tooltip');
                tooltip.style.display = 'none';
                document.removeEventListener('mousemove', onMouseMoveRightHandle);
                document.removeEventListener('mouseup', onMouseUpRightHandle);
                activeNote = null;
                activeTrack = null;
                setTimeout(() => { 
                    isDraggingOrResizing = false; 
                }, 0);
                return;
            }
        }

        activeNote.noteData.duration = newDuration;
        
        // Update all linked note elements
        activeNote.noteData.elements.forEach(el => {
            el.style.width = (newDuration * stepWidth) + 'px';
        });

        // Extend timeline width if needed
        updateTimelineWidth(activeTrack);

        let tooltip = document.getElementById('duration-tooltip');
        tooltip.style.display = 'none';

        document.removeEventListener('mousemove', onMouseMoveRightHandle);
        document.removeEventListener('mouseup', onMouseUpRightHandle);
        activeNote = null;
        activeTrack = null;
        setTimeout(() => { 
            isDraggingOrResizing = false; 
            saveState();
        }, 0);
    }



    function exportTracks() {
        if (tracks.length === 0) {
            alert('No tracks to export.');
            return;
        }

        let allNotes = [];
        const allStartTimes = new Set();

        tracks.forEach(track => {
            if (track.name.trim() === '') {
                alert('All tracks must have an instrument name for export.');
                throw new Error("Missing instrument name.");
            }
            track.notes.forEach(note => {
                allNotes.push({
                    instrument: track.name,
                    duration: note.duration,
                    start: note.start,
                });
                allStartTimes.add(note.start);
            });
        });

        if (allNotes.length === 0) {
            alert('No notes to export.');
            return;
        }

        let exportData = '';
        let lastTime = 0;
        const sortedStartTimes = Array.from(allStartTimes).sort((a, b) => a - b);
        let notesCount = 0;

        for (const time of sortedStartTimes) {
            const notesAtTime = allNotes.filter(note => Math.abs(note.start - time) < 0.001);
            if (notesAtTime.length > 0) {
                if (time > lastTime) {
                    const delay = time - lastTime;
                    exportData += 'x,' + delay.toFixed(2) + ' ';
                    notesCount++;
                }
                const notesString = notesAtTime.map(note => {
                    return `${note.instrument},${note.duration.toFixed(2)}`;
                }).join(' ');
                exportData += notesString + ' ';
                notesCount += notesAtTime.length;

                if (notesCount >= 12) {
                    exportData += '';
                    notesCount = 0;
                }
                lastTime = time;
            }
        }

        let pasteContent = exportData.trim();
        const newTab = window.open();
        newTab.document.open();
        newTab.document.write(`
            <pre id="song-data">${pasteContent}</pre>
            <button id="downloadBtn">Download .song</button>
            <script>
                document.getElementById('downloadBtn').addEventListener('click', () => {
                    const text = document.getElementById('song-data').textContent;
                    const blob = new Blob([text], { type: 'text/plain' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'music.song';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                });
    </script>
        `);
        newTab.document.close();
    }

    function importTracks() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.song,text/plain';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = e => {
                const content = e.target.result;
                parseAndLoadSong(content);
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function parseAndLoadSong(content) {
        const previousState = localStorage.getItem('musicMakerState');
        try {
            document.querySelector('#track-headers-table tbody').innerHTML = '';
            document.querySelector('#timeline-table tbody').innerHTML = '';
            tracks = [];
            trackCount = 0;

            const instrumentNotes = {};
            let currentTime = 0;
            const parts = content.trim().split(/\s+/);

            if (parts.length === 1 && parts[0] === '') {
                addTrack();
                return;
            }

            parts.forEach(part => {
                if (!part) return;
                const [instrument, value] = part.split(',');
                if (instrument === 'x') {
                    const delay = parseFloat(value);
                    if (isNaN(delay)) throw new Error(`Invalid delay value: ${value}`);
                    currentTime += delay;
                } else {
                    const duration = parseFloat(value);
                    if (!instrument || value === undefined || isNaN(duration)) throw new Error(`Invalid note format: ${part}`);
                    if (!instrumentNotes[instrument]) {
                        instrumentNotes[instrument] = [];
                    }
                    instrumentNotes[instrument].push({
                        start: currentTime,
                        duration: duration
                    });
                }
            });

            const noteSequences = {};
            Object.keys(instrumentNotes).forEach(instrument => {
                const sequence = JSON.stringify(instrumentNotes[instrument]);
                if (!noteSequences[sequence]) {
                    noteSequences[sequence] = [];
                }
                noteSequences[sequence].push(instrument);
            });

            if (Object.keys(noteSequences).length === 0) {
                 addTrack(); // Add a default track if the file was valid but empty of notes
            }

            Object.values(noteSequences).forEach(instruments => {
                let parentTrack = null;
                instruments.forEach((instrumentName, index) => {
                    if (index === 0) {
                        parentTrack = addTrack(null, false, true);
                        parentTrack.name = instrumentName;
                        parentTrack.input.value = instrumentName;
                        const notes = instrumentNotes[instrumentName];
                        notes.forEach(noteInfo => {
                            const note = { start: noteInfo.start, duration: noteInfo.duration, elements: [], track: parentTrack };
                            parentTrack.notes.push(note);
                            createNoteElement(parentTrack, note);
                        });
                    } else {
                        let newTrack = addTrack(parentTrack, true, true);
                        newTrack.name = instrumentName;
                        newTrack.input.value = instrumentName;
                        newTrack.groupId = parentTrack.groupId;

                        const originalIndex = tracks.indexOf(parentTrack);
                        tracks.splice(tracks.indexOf(newTrack), 1);
                        tracks.splice(originalIndex + 1, 0, newTrack);

                        newTrack.isLinked = true;
                        updateLinkButtons(newTrack);
                        newTrack.color = parentTrack.color;
                        newTrack.notes = parentTrack.notes;

                        newTrack.notes.forEach(note => createNoteElement(newTrack, note));
                    }
                });
            });

            const tbody = document.querySelector('#timeline-table tbody');
            if (!tbody) {
                tbody = document.createElement('tbody');
                document.querySelector('#timeline-table').appendChild(tbody);
            }
            tracks.forEach(t => tbody.appendChild(t.timelineElem));

            updateTrackLabels();
            updateTrackStyles();
            updateTrackColors();
            redrawAllNotes();
            updateAllTimelineWidths();
            saveState();
        } catch (error) {
            alert('Error parsing file. Please ensure it is a valid .song file.\nYour previous work has been restored.');
            console.error('Import error:', error);
            if (previousState) {
                localStorage.setItem('musicMakerState', previousState);
            } else {
                localStorage.removeItem('musicMakerState');
            }
            location.reload();
        }
    }

    function showContextMenu(e) {
        
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.display = 'block';

        const isNote = e.target.classList.contains('note');

        let menuContent = '<ul>';
        if (isNote) {
            menuContent += '<li id="menu-copy">Copy</li>';
            menuContent += '<li id="menu-cut">Cut</li>';
            menuContent += '<li id="menu-delete">Delete</li>';
        } else {
            menuContent += '<li id="menu-new-note">New Note</li>';
            menuContent += '<li id="menu-paste">Paste</li>';
        }
        menuContent += '</ul>';
        contextMenu.innerHTML = menuContent;

        document.getElementById('menu-copy')?.addEventListener('click', () => {
            copySelection();
            document.getElementById('context-menu').style.display = 'none';
        });

        document.getElementById('menu-cut')?.addEventListener('click', () => {
            copySelection();
            isCut = true;
            selectedNotes.forEach(n => n.elements.forEach(el => el.classList.add('ghosted')));
            document.getElementById('context-menu').style.display = 'none';
        });

        document.getElementById('menu-delete')?.addEventListener('click', () => {
            selectedNotes.forEach(noteData => {
                const parentTrack = tracks.find(t => t.notes.includes(noteData));
                if (!parentTrack) return;
                const noteIndex = parentTrack.notes.indexOf(noteData);
                if (noteIndex > -1) parentTrack.notes.splice(noteIndex, 1);
                noteData.elements.forEach(el => el.remove());
            });
            clearSelection();
            saveState();
            document.getElementById('context-menu').style.display = 'none';
        });

        document.getElementById('menu-paste')?.addEventListener('click', () => {
            if (clipboard) {
                isPasting = true;
                updateGhostNotes();
            }
            document.getElementById('context-menu').style.display = 'none';
        });

        document.getElementById('menu-new-note')?.addEventListener('click', () => {
            const timeline = e.target.closest('.timeline-col');
            if (!timeline) return;

            const track = tracks.find(t => t.timeline === timeline);
            if (!track) return;

            let rect = timeline.getBoundingClientRect();
            let x = e.clientX - rect.left;

            let step = Math.floor((Math.round(x / (stepWidth / tempo)) / tempo) * 100) / 100;
            if (step < 0) step = 0;

            if (track.notes.some(n => n.start === step)) return;

            let duration = 1;

            for (let i = 0; i < track.notes.length; i++) {
                let n = track.notes[i];
                if (step < n.start + n.duration && step + duration > n.start) {
                    return; // Overlap, so don't create the note
                }
            }

            let note = { start: step, duration: duration, elements: [], track: track };
            track.notes.push(note);

            tracks.forEach(tr => {
                if (tr.notes === track.notes) {
                    createNoteElement(tr, note);
                }
            });
            updateTimelineWidth(track);
            saveState();
            document.getElementById('context-menu').style.display = 'none';
        });
    }



    document.addEventListener('click', () => {
        document.getElementById('context-menu').style.display = 'none';
    });

    let marqueeBox = document.getElementById('marquee-box');
    let isMarquee = false;
    let startX, startY;
    const mainContent = document.getElementById('main-content');

    mainContent.addEventListener('mousedown', (e) => {
        if (e.target.closest('.instrument-col')) return;
        if (e.target.closest('.note') || e.button !== 0) return;

        isMarquee = true;
        startX = e.clientX;
        startY = e.clientY;

        marqueeBox.style.left = `${e.clientX}px`;
        marqueeBox.style.top = `${e.clientY}px`;
        marqueeBox.style.width = '0px';
        marqueeBox.style.height = '0px';
        marqueeBox.style.display = 'block';

        mainContent.addEventListener('mousemove', onMouseMoveMarquee);
        mainContent.addEventListener('mouseup', onMouseUpMarquee);
    });



    function onMouseMoveMarquee(e) {
        if (!isMarquee) return;

        let currentX = e.clientX;
        let currentY = e.clientY;

        let width = currentX - startX;
        let height = currentY - startY;

        marqueeBox.style.width = `${Math.abs(width)}px`;
        marqueeBox.style.height = `${Math.abs(height)}px`;

        const newLeft = (width > 0 ? startX : currentX);
        const newTop = (height > 0 ? startY : currentY);

        marqueeBox.style.left = `${newLeft}px`;
        marqueeBox.style.top = `${newTop}px`;
    }



    function onMouseUpMarquee(e) {
        if (!isMarquee) return;
        isMarquee = false;
        marqueeBox.style.display = 'none';

        const marqueeRect = {
            left: parseFloat(marqueeBox.style.left),
            top: parseFloat(marqueeBox.style.top),
            width: parseFloat(marqueeBox.style.width),
            height: parseFloat(marqueeBox.style.height)
        };
        marqueeRect.right = marqueeRect.left + marqueeRect.width;
        marqueeRect.bottom = marqueeRect.top + marqueeRect.height;

        if (!e.shiftKey) {
            clearSelection();
        }

        tracks.forEach(track => {
            track.notes.forEach(note => {
                note.elements.forEach(el => {
                    const elRect = el.getBoundingClientRect();
                    if (
                        marqueeRect.left < elRect.right &&
                        marqueeRect.right > elRect.left &&
                        marqueeRect.top < elRect.bottom &&
                        marqueeRect.bottom > elRect.top
                    ) {
                        if (!selectedNotes.includes(note)) {
                            selectedNotes.push(note);
                            note.elements.forEach(selectedEl => selectedEl.classList.add('selected'));
                        }
                    }
                });
            });
        });

        mainContent.removeEventListener('mousemove', onMouseMoveMarquee);
        mainContent.removeEventListener('mouseup', onMouseUpMarquee);
    }

    let rightMouseDown = false;
    let isPanning = false;
    let didPan = false;
    let panStartX, panStartY;

    mainContent.addEventListener('mousedown', (e) => {
        if (e.button === 2) { // Right mouse button
            rightMouseDown = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            didPan = false;
        }
    });

    mainContent.addEventListener('pointermove', (e) => {
        if (rightMouseDown && !isPanning) {
            const dx = Math.abs(e.clientX - panStartX);
            const dy = Math.abs(e.clientY - panStartY);
            if (dx > 10 || dy > 10) {
                isPanning = true;
                mainContent.style.cursor = 'grabbing';
            }
        }
        if (isPanning) {
            didPan = true;
            const dx = e.clientX - panStartX;
            const dy = e.clientY - panStartY;
            timelineContainer.scrollLeft -= dx;
            timelineContainer.scrollTop -= dy;
            panStartX = e.clientX;
            panStartY = e.clientY;
        }
    });

    mainContent.addEventListener('mouseup', (e) => {
        if (e.button === 2) {
            rightMouseDown = false;
            isPanning = false;
            mainContent.style.cursor = 'grab';
        }
    });

    mainContent.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (didPan) {
            didPan = false; // reset for next time
        } else {
            showContextMenu(e);
        }
        return false;
    });

    const customTooltip = document.getElementById('custom-tooltip');

    function showTooltip(e) {
        const target = e.target;
        if (target.title) {
            customTooltip.textContent = target.title;
            customTooltip.style.display = 'block';
            customTooltip.style.left = (e.clientX + 15) + 'px';
            customTooltip.style.top = (e.clientY + 15) + 'px';
        }
    }

    function hideTooltip() {
        customTooltip.style.display = 'none';
    }

    document.addEventListener('mousemove', (e) => {
        customTooltip.style.left = (e.clientX + 15) + 'px';
        customTooltip.style.top = (e.clientY + 15) + 'px';
    });

    const trackHeadersContainer = document.getElementById('track-headers-container');
    const timelineContainer = document.getElementById('timeline-container');

    trackHeadersContainer.addEventListener('scroll', () => {
        timelineContainer.scrollTop = trackHeadersContainer.scrollTop;
    });

    timelineContainer.addEventListener('scroll', () => {
        trackHeadersContainer.scrollTop = timelineContainer.scrollTop;
    });

    loadState();
});