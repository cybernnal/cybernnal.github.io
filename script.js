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
    let masterVolume = 1;





    let recentCustomColors = [];

    function saveRecentColors() {
        localStorage.setItem('musicMakerRecentColors', JSON.stringify(recentCustomColors));
    }

    function loadRecentColors() {
        const saved = localStorage.getItem('musicMakerRecentColors');
        if (saved) {
            recentCustomColors = JSON.parse(saved);
        }
    }
    loadRecentColors();







    document.addEventListener('keydown', (e) => {

    });
















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
                
            });
        }

        updateTrackLabels();
        updateTrackStyles();
        updateTrackColors();

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
        timeline.style.minWidth = '1000px'; // initial width
        tdTimeline.appendChild(timeline);
        trTimeline.appendChild(tdTimeline);

        headersTbody.appendChild(trHeader);
        timelineTbody.appendChild(trTimeline);

        const instrColHeight = instrCol.offsetHeight;
        timeline.style.height = `${instrColHeight}px`;

        track.elem = trHeader; // Keep a reference to the header row for dragging
        track.timelineElem = trTimeline; // Keep a reference to the timeline row
        track.timeline = timeline;
        track.input = input;
        track.label = label;

        dupBtn.addEventListener('click', () => {
            const sourceTrack = track;
            let parentTrack = sourceTrack;
            if (sourceTrack.isLinked) {
                parentTrack = tracks.find(t => !t.isLinked && t.notes === sourceTrack.notes);
            }
            const parentIndex = tracks.indexOf(parentTrack);

            const children = [];
            for (let i = parentIndex + 1; i < tracks.length; i++) {
                const nextTrack = tracks[i];
                if (nextTrack.isLinked && nextTrack.notes === parentTrack.notes) {
                    children.push(nextTrack);
                } else {
                    break;
                }
            }

            const groupToDuplicate = [parentTrack, ...children];
            const lastTrackOfGroup = groupToDuplicate[groupToDuplicate.length - 1];
            const insertionIndex = tracks.indexOf(lastTrackOfGroup) + 1;

            const newTracks = [];
            let newParentTrack = null;

            groupToDuplicate.forEach((trackToDup, i) => {
                let newTrack;
                if (i === 0) {
                    newTrack = addTrack(trackToDup, false, true);
                    newParentTrack = newTrack;
                } else {
                    newTrack = addTrack(trackToDup, true, true);
                    newTrack.isLinked = true;
                    newTrack.notes = newParentTrack.notes;
                    newTrack.groupId = newParentTrack.groupId;
                }
                newTracks.push(newTrack);
            });

            // Move the new tracks from the end to the correct position
            const addedTracks = tracks.splice(tracks.length - newTracks.length, newTracks.length);
            tracks.splice(insertionIndex, 0, ...addedTracks);

            // Re-render tables
            const headersTbody = document.querySelector('#track-headers-table tbody');
            const timelineTbody = document.querySelector('#timeline-table tbody');
            headersTbody.innerHTML = '';
            timelineTbody.innerHTML = '';
            tracks.forEach(t => {
                headersTbody.appendChild(t.elem);
                timelineTbody.appendChild(t.timelineElem);
            });

            updateTrackLabels();
            updateTrackStyles();
            updateTrackColors();
            saveState();
        });
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
            newTrack.notes.forEach(note => createNoteElement(newTrack, note));

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





    function onMouseDownNote(e) {
        isDraggingOrResizing = true;
        document.body.classList.add('dragging');

        const noteElement = e.target;
        const note = noteElement.noteData;
        const track = note.track;
        const initialX = e.clientX;
        const initialLeft = noteElement.offsetLeft;
        const initialWidth = noteElement.offsetWidth;

        const isResizeLeft = e.offsetX < 10;
        const isResizeRight = e.offsetX > noteElement.offsetWidth - 10;

        function onMouseMove(e) {
            const dx = e.clientX - initialX;
            if (isResizeLeft) {
                const newWidth = initialWidth - dx;
                const newLeft = initialLeft + dx;
                if (newWidth > 0) {
                    note.start = newLeft / stepWidth;
                    note.duration = newWidth / stepWidth;
                }
            } else if (isResizeRight) {
                const newWidth = initialWidth + dx;
                if (newWidth > 0) {
                    note.duration = newWidth / stepWidth;
                }
            } else {
                const newLeft = initialLeft + dx;
                note.start = newLeft / stepWidth;
            }
            redrawAllNotes();
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.classList.remove('dragging');
            isDraggingOrResizing = false;
            updateAllTimelineWidths();
            saveState();
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
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

    function renderRecentColors() {
        const container = document.getElementById('recent-colors-grid');
        container.innerHTML = '';
        
        const totalRecentSwatches = 9;
        for (let i = 0; i < totalRecentSwatches; i++) {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            
            if (i < recentCustomColors.length) {
                const color = recentCustomColors[i];
                swatch.dataset.color = color;
                swatch.style.backgroundColor = color;
            } else {
                // Default white swatch
                swatch.dataset.color = '#ffffff';
                swatch.style.backgroundColor = '#ffffff';
            }
            
            container.appendChild(swatch);
        }
    }

    colorPaletteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        renderRecentColors();
        colorPaletteDropdown.classList.toggle('open');
    });

    colorPaletteDropdown.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-swatch')) {
            const color = e.target.dataset.color;
            changeTrackColors(color);
            colorPaletteDropdown.classList.remove('open');
        }
    });

    document.getElementById('custom-color-btn').addEventListener('click', () => {
        const colorPickerWrapper = document.getElementById('color-picker-wrapper');
        colorPickerWrapper.style.display = colorPickerWrapper.style.display === 'flex' ? 'none' : 'flex';
    });

    document.getElementById('confirm-color-btn').addEventListener('click', () => {
        const colorPicker = document.getElementById('color-picker');
        const color = colorPicker.value;
        changeTrackColors(color);

        if (!recentCustomColors.includes(color)) {
            recentCustomColors.unshift(color);
            if (recentCustomColors.length > 9) {
                recentCustomColors.pop();
            }
            saveRecentColors();
        }

        colorPaletteDropdown.classList.remove('open');
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

    document.getElementById('masterVolumeSlider').addEventListener('input', (e) => {
        masterVolume = parseFloat(e.target.value);
        saveState();
    });




    let currentlyDragging = null;
    let draggingGroup = [];
    let draggingTimelineGroup = [];


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
        draggingTimelineGroup = [parentTrack.timelineElem];

        // Find all children of that parent
        const startIndex = tracks.indexOf(parentTrack);
        for (let i = startIndex + 1; i < tracks.length; i++) {
            const nextTrack = tracks[i];
            if (nextTrack.isLinked && nextTrack.notes === parentTrack.notes) {
                draggingGroup.push(nextTrack.elem);
                draggingTimelineGroup.push(nextTrack.timelineElem);
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
        const headersTbody = currentlyDragging.parentElement;
        const timelineTbody = document.querySelector('#timeline-table tbody');

        // Find the next row that isn't part of the group we're dragging
        const allRows = [...headersTbody.querySelectorAll('tr:not(.dragging)')];
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

        // Move the entire header group
        if (nextRow) {
            draggingGroup.forEach(tr => headersTbody.insertBefore(tr, nextRow));
        } else {
            draggingGroup.forEach(tr => headersTbody.appendChild(tr));
        }

        // Now, move the timeline group
        const nextTrack = tracks.find(t => t.elem === nextRow);
        if (nextTrack) {
            const nextTimelineRow = nextTrack.timelineElem;
            draggingTimelineGroup.forEach(tr => timelineTbody.insertBefore(tr, nextTimelineRow));
        } else {
            draggingTimelineGroup.forEach(tr => timelineTbody.appendChild(tr));
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
        // const timelineTbody = document.querySelector('#timeline-table tbody');
        // if (timelineTbody) {
        //     tracks.forEach(track => {
        //         timelineTbody.appendChild(track.timelineElem);
        //     });
        // } else {
        //     const newTimelineTbody = document.createElement('tbody');
        //     tracks.forEach(track => {
        //         newTimelineTbody.appendChild(track.timelineElem);
        //     });
        //     document.querySelector('#timeline-table').appendChild(newTimelineTbody);
        // }

        document.removeEventListener('mousemove', dragOver);
        document.removeEventListener('mouseup', dragEnd);
        currentlyDragging = null;
        draggingGroup = [];
        draggingTimelineGroup = [];

        // Update labels to reflect new order
        updateTrackLabels();
        updateTrackColors();
        
        // Use a timeout to reset the flag after the click event has had time to fire and be ignored.
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

        for (const time of sortedStartTimes) {
            const notesAtTime = allNotes.filter(note => Math.abs(note.start - time) < 0.001);
            if (notesAtTime.length > 0) {
                if (time > lastTime) {
                    const delay = time - lastTime;
                    exportData += 'x,' + delay.toFixed(2) + '\n';
                }
                const notesString = notesAtTime.map(note => {
                    return `${note.instrument},${note.duration.toFixed(2)}`;
                }).join('\n');
                exportData += notesString + '\n';
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

    function showTooltip(target, title) {
        const existingTooltip = document.querySelector('.custom-tooltip-new');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        if (title) {
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip-new';
            tooltip.textContent = title;

            const parent = target.parentElement; // .instrument-col
            parent.appendChild(tooltip);

            const targetRect = target.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();
            
            // Position below the button
            tooltip.style.left = `${targetRect.left - parentRect.left + targetRect.width / 2 - tooltip.offsetWidth / 2}px`;
            tooltip.style.top = `${targetRect.top - parentRect.top + targetRect.height + 5}px`;
        }
    }

    const timelineContainer = document.getElementById('timeline-container');
    const trackHeadersContainer = document.getElementById('track-headers-container');

    timelineContainer.addEventListener('scroll', () => {
        trackHeadersContainer.scrollTop = timelineContainer.scrollTop;
    });

    trackHeadersContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        timelineContainer.scrollTop += e.deltaY;
    });

    const mainContent = document.getElementById('main-content');

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

    mainContent.addEventListener('contextmenu', e => e.preventDefault());

    loadState();
});
