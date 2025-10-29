var MusicMaker = MusicMaker || {};

MusicMaker.nextNoteId = 0;

MusicMaker.tracks = [];
MusicMaker.ALL_PITCH_NAMES = [];
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
for (let midi = 109; midi >= 6; midi--) { // C#8 is 109, F#-1 is 6
    const noteIndex = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    MusicMaker.ALL_PITCH_NAMES.push(noteNames[noteIndex] + octave);
}

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
                    const positionInBeats = oldTimeUnit > 0 ? playback.playbackPosition / oldTimeUnit : 0;
                    const newTimeUnit = 0.05 * newTempo;
                    playback.playbackPosition = positionInBeats * newTimeUnit;
                    playback.currentTempo = newTempo;
                    MusicMaker.updateCursor(playback.playbackPosition);
                }
            }

            MusicMaker.drawTimelineRuler();

            switch (newTempo) {
                case 1: minNoteDuration = 1; break;
                case 2: minNoteDuration = 0.5; break;
                case 3: minNoteDuration = 0.33; break;
                case 4: minNoteDuration = 0.25; break;
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

MusicMaker.populateInstrumentSelector = function() {
    const selector = document.getElementById('instrument-selector');
    selector.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Instrument';
    selector.appendChild(defaultOption);

    for (const instrumentName in MusicMaker.state.instruments) {
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

MusicMaker.createUI = function(trackPitches = null, trackLayout = null, collapseState = null) {
    MusicMaker.tracks = [];
    const appContainer = document.getElementById('app-container');
    appContainer.innerHTML = '';

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

    if (trackPitches) {
        trackPitches.forEach(fullPitchName => {
            if (trackLayout.hasOwnProperty(fullPitchName) && fullPitchName !== 'Percussion') {
                const instruments = trackLayout[fullPitchName];
                if (instruments.length > 0) {
                    const parentInstrument = instruments[0];
                    const isCollapsed = collapseState ? collapseState[fullPitchName] !== false : true;
                    MusicMaker.addTrack(fullPitchName, false, null, parentInstrument, false, isCollapsed);
                    createdPitches.add(fullPitchName);

                    for (let i = 1; i < instruments.length; i++) {
                        const instrumentName = instruments[i];
                        const parentTrack = document.querySelector(`.parent-track[data-pitch="${fullPitchName}"]`);
                        MusicMaker.addTrack(fullPitchName, false, parentTrack, instrumentName, true);
                    }
                }
            }
        });
    }

    MusicMaker.ALL_PITCH_NAMES.forEach(fullPitchName => {
        if (!createdPitches.has(fullPitchName)) {
            const isCollapsed = collapseState ? collapseState[fullPitchName] !== false : true;
            const midi = MusicMaker.noteNameToMidi(fullPitchName);
            let defaultInstrument = 'diapason';
            for (const instName in MusicMaker.instrumentData.instruments) {
                const inst = MusicMaker.instrumentData.instruments[instName];
                if (midi >= inst.noteRange[0] && midi <= inst.noteRange[1]) {
                    defaultInstrument = instName;
                    break;
                }
            }
            MusicMaker.addTrack(fullPitchName, false, null, defaultInstrument, false, isCollapsed);
        }
    });

    if (trackLayout && trackLayout['Percussion']) {
        const percussionInstruments = trackLayout['Percussion'];
        percussionInstruments.forEach((instrumentName, index) => {
            MusicMaker.addTrack('Percussion', false, null, instrumentName, false, true, index);
        });
    }

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

    setTimeout(() => {
        const headersTbody = document.querySelector('#track-headers-table tbody');
        const timelineTbody = document.querySelector('#timeline-table tbody');
        const headerRows = Array.from(headersTbody.querySelectorAll('tr'));
        const timelineRows = Array.from(timelineTbody.querySelectorAll('tr'));

        const sortedHeaderRows = headerRows.sort((a, b) => {
            const pitchA = a.dataset.pitch;
            const pitchB = b.dataset.pitch;
            if (pitchA === 'Percussion') return 1;
            if (pitchB === 'Percussion') return -1;
            return MusicMaker.ALL_PITCH_NAMES.indexOf(pitchA) - MusicMaker.ALL_PITCH_NAMES.indexOf(pitchB);
        });

        const sortedTimelineRows = timelineRows.sort((a, b) => {
            const pitchA = a.dataset.pitch;
            const pitchB = b.dataset.pitch;
            if (pitchA === 'Percussion') return 1;
            if (pitchB === 'Percussion') return -1;
            return MusicMaker.ALL_PITCH_NAMES.indexOf(pitchA) - MusicMaker.ALL_PITCH_NAMES.indexOf(pitchB);
        });

        sortedHeaderRows.forEach(row => headersTbody.appendChild(row));
        sortedTimelineRows.forEach(row => timelineTbody.appendChild(row));
    }, 0);
};

MusicMaker.createHarmonicsModal = function(pitch, instrumentName) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const title = document.createElement('h2');
    title.textContent = `Harmonics for ${pitch} - ${instrumentName}`;
    modalContent.appendChild(title);

    const instrumentSelector = document.createElement('select');
    for (const inst in MusicMaker.state.instruments) {
        const option = document.createElement('option');
        option.value = inst;
        option.textContent = inst.charAt(0).toUpperCase() + inst.slice(1);
        instrumentSelector.appendChild(option);
    }
    modalContent.appendChild(instrumentSelector);

    const pitchSelector = document.createElement('select');
    modalContent.appendChild(pitchSelector);

    function updatePitchSelector() {
        const selectedInstrument = instrumentSelector.value;
        const instrumentData = MusicMaker.instrumentData.instruments[selectedInstrument];
        pitchSelector.innerHTML = '';

        if (instrumentData) {
            const [minMidi, maxMidi] = instrumentData.noteRange;
            const availablePitches = MusicMaker.ALL_PITCH_NAMES.filter(pitch => {
                const midi = MusicMaker.noteNameToMidi(pitch);
                return midi >= minMidi && midi <= maxMidi;
            });

            availablePitches.forEach(p => {
                const option = document.createElement('option');
                option.value = p;
                option.textContent = p;
                pitchSelector.appendChild(option);
            });
        } else {
            // For custom instruments with no defined range, show all pitches
            MusicMaker.ALL_PITCH_NAMES.forEach(p => {
                const option = document.createElement('option');
                option.value = p;
                option.textContent = p;
                pitchSelector.appendChild(option);
            });
        }
    }

    instrumentSelector.addEventListener('change', updatePitchSelector);
    updatePitchSelector();

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add Harmonic';
    addBtn.onclick = () => {
        const beforeState = MusicMaker.createSnapshot();
        const selectedInstrument = instrumentSelector.value;
        const selectedPitch = pitchSelector.value;

        const instrumentData = MusicMaker.instrumentData.instruments[selectedInstrument];
        if (instrumentData) {
            const midi = MusicMaker.noteNameToMidi(selectedPitch);
            if (midi < instrumentData.noteRange[0] || midi > instrumentData.noteRange[1]) {
                alert(`The selected instrument '${selectedInstrument}' cannot play the pitch '${selectedPitch}'.`);
                return;
            }
        }

        const trackId = `${pitch}|${instrumentName}`;
        if (!MusicMaker.state.harmonics[trackId]) {
            MusicMaker.state.harmonics[trackId] = [];
        }

        MusicMaker.state.harmonics[trackId].push({ instrumentName: selectedInstrument, pitch: selectedPitch });
        renderHarmonicsList();
        MusicMaker.commitChange(beforeState);
    };
    modalContent.appendChild(addBtn);

    const harmonicsList = document.createElement('div');
    modalContent.appendChild(harmonicsList);

    function renderHarmonicsList() {
        harmonicsList.innerHTML = '';
        const trackId = `${pitch}|${instrumentName}`;
        const harmonics = MusicMaker.state.harmonics[trackId] || [];

        harmonics.forEach((harmonic, index) => {
            const harmonicItem = document.createElement('div');
            harmonicItem.textContent = `${harmonic.instrumentName} - ${harmonic.pitch}`;

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => {
                const beforeState = MusicMaker.createSnapshot();
                MusicMaker.state.harmonics[trackId].splice(index, 1);
                renderHarmonicsList();
                MusicMaker.commitChange(beforeState);
            };
            harmonicItem.appendChild(deleteBtn);
            harmonicsList.appendChild(harmonicItem);
        });
    }

    renderHarmonicsList();

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => {
        modal.remove();
    };
    modalContent.appendChild(closeBtn);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
};

MusicMaker.addTrack = function(fullPitchName, isButton, container = null, instrumentName = 'diapason', isChild = false, isCollapsed = true, percIndex = -1) {
    const headersTbody = document.querySelector('#track-headers-table tbody');
    const timelineTbody = document.querySelector('#timeline-table tbody');

    let newInstrumentName = instrumentName;
    if (isButton) {
        const existingInstrumentElements = Array.from(headersTbody.querySelectorAll(`tr[data-pitch="${fullPitchName}"]`));
        const usedInstruments = existingInstrumentElements.map(el => el.dataset.instrument);
        const allInstruments = Object.keys(MusicMaker.state.instruments);
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

    const isPercussion = fullPitchName === 'Percussion';

    if (isChild && !isPercussion) {
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
    key.className = `key ${isBlackKey ? 'key--black' : 'key--white'} ${isPercussion ? 'key--percussion' : ''}`;

    const keyContentWrapper = document.createElement('div');
    keyContentWrapper.className = 'key-content-wrapper';

    const pitchNameSpan = document.createElement('span');
    pitchNameSpan.className = 'pitch-name';
    if (isPercussion) {
        pitchNameSpan.textContent = `Perc ${percIndex + 1}`;
    } else {
        pitchNameSpan.textContent = fullPitchName;
    }
    keyContentWrapper.appendChild(pitchNameSpan);

    const trackControls = document.createElement('div');
    trackControls.className = 'track-controls';

    if (!isChild || isPercussion) {
        if (isCollapsed && !isPercussion) {
            trHeader.classList.add('collapsed');
        }
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = isCollapsed ? '&#9654;' : '&#9660;';
        expandBtn.style.visibility = 'hidden';

        if (!isPercussion) {
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
            addBtn.onclick = (e) => {
                e.stopPropagation();
                if (trHeader.classList.contains('collapsed')) {
                    expandBtn.click();
                }
                MusicMaker.addTrack(fullPitchName, true, trHeader, undefined, true, false);
                expandBtn.style.visibility = 'visible';
            };
            trackControls.appendChild(addBtn);

            const harmonicsBtn = document.createElement('button');
            harmonicsBtn.className = 'harmonics-btn track-control-btn';
            harmonicsBtn.innerHTML = '<svg class="harmonics-icon" width="13" height="13" fill="#000000" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 364.59 364.591" xml:space="preserve"><g><g><path d="M360.655,258.05V25c0-13.807-11.191-25-25-25H130.09c-13.807,0-25,11.193-25,25v206.27c-10.569-3.184-22.145-4.271-34.058-2.768C29.527,233.738-0.293,268.3,4.427,305.695c4.719,37.396,42.189,63.464,83.694,58.226c40.015-5.049,66.969-37.146,66.969-73.181V50h155.564v146.794c-10.591-3.2-22.19-4.297-34.134-2.79c-41.504,5.237-71.323,39.798-66.604,77.193s42.188,63.464,83.694,58.227C332.951,324.458,360.655,293.275,360.655,258.05z"/></g></g></svg>';
            harmonicsBtn.onclick = (e) => {
                e.stopPropagation();
                MusicMaker.createHarmonicsModal(fullPitchName, newInstrumentName);
            };
            trackControls.appendChild(harmonicsBtn);


        }

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

        const harmonicsBtn = document.createElement('button');
        harmonicsBtn.className = 'harmonics-btn';
        harmonicsBtn.innerHTML = '<svg class="harmonics-icon" width="13" height="13" fill="#000000" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 364.59 364.591" xml:space="preserve"><g><g><path d="M360.655,258.05V25c0-13.807-11.191-25-25-25H130.09c-13.807,0-25,11.193-25,25v206.27c-10.569-3.184-22.145-4.271-34.058-2.768C29.527,233.738-0.293,268.3,4.427,305.695c4.719,37.396,42.189,63.464,83.694,58.226c40.015-5.049,66.969-37.146,66.969-73.181V50h155.564v146.794c-10.591-3.2-22.19-4.297-34.134-2.79c-41.504,5.237-71.323,39.798-66.604,77.193s42.188,63.464,83.694,58.227C332.951,324.458,360.655,293.275,360.655,258.05z"/></g></g></svg>';
        harmonicsBtn.onclick = (e) => {
            e.stopPropagation();
            MusicMaker.createHarmonicsModal(fullPitchName, newInstrumentName);
        };
        trackControls.appendChild(harmonicsBtn);


    }

    keyContentWrapper.appendChild(trackControls);
    key.appendChild(keyContentWrapper);
    tdHeader.appendChild(key);
    trHeader.appendChild(tdHeader);

    const tdTimeline = document.createElement('td');
    if (isBlackKey) {
        tdTimeline.classList.add('timeline-black-key');
    } else {
        tdTimeline.classList.add('timeline-white-key');
    }
    const timeline = document.createElement('div');
    timeline.className = 'timeline-col';
    timeline.dataset.instrument = newInstrumentName;

    timeline.addEventListener('dblclick', (e) => {
        const beforeState = MusicMaker.createSnapshot();
        if (e.button !== 0) return;
        const startPosition = e.offsetX / stepWidth;
        const snappedStart = Math.round(startPosition / 0.25) * 0.25;

        const notesOnTimeline = MusicMaker.state.tracks.filter(n => n.pitch === fullPitchName && n.instrumentName === newInstrumentName);

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
            id: MusicMaker.nextNoteId++,
            instrumentName: newInstrumentName,
            pitch: fullPitchName,
            start: finalStart,
            duration: minNoteDuration
        };
        MusicMaker.state.tracks.push(newNote);
        MusicMaker.renderNote(newNote);
        MusicMaker.updateSongTotalTime();
        checkAndGrowTimeline(newNote);
        MusicMaker.commitChange(beforeState);
    });

    tdTimeline.appendChild(timeline);
    trTimeline.appendChild(tdTimeline);

    if (container) {
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
        } else {
            timelineTbody.appendChild(trTimeline);
        }

    } else {
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
        notes: [],
        harmonics: []
    };
    MusicMaker.tracks.push(track);
};

MusicMaker.updateNoteAppearance = function(noteElement, noteData) {
    noteElement.textContent = noteData.instrumentName.substring(0, 3);

    const instrument = MusicMaker.state.instruments[noteData.instrumentName];
    const hue = instrument ? instrument.hue : 200;
    const saturation = instrument ? instrument.saturation : 70;

    const overallPitchIndex = MusicMaker.ALL_PITCH_NAMES.indexOf(noteData.pitch);
    const totalPitches = MusicMaker.ALL_PITCH_NAMES.length;

    const maxLightness = 90;
    const minLightness = 25;
    const lightnessRange = maxLightness - minLightness;

    const lightness = maxLightness - (overallPitchIndex / (totalPitches - 1)) * lightnessRange;

    noteElement.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    noteElement.style.borderColor = `hsl(${hue}, ${saturation}%, ${lightness - 20}%)`;
};

MusicMaker.renderNote = function(note) {
    const track = MusicMaker.tracks.find(t => t.pitch === note.pitch && t.instrumentName === note.instrumentName);
    if (!track) {
        return;
    }
    const timeline = track.timeline;

    if (!timeline) {
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

        if (now - lastRightClick < 300) {
            const beforeState = MusicMaker.createSnapshot();
            const clickedNote = e.target;
            if (clickedNote.classList.contains('selected')) {
                const selectedNotes = document.querySelectorAll('.note.selected');
                selectedNotes.forEach(noteElement => {
                    const noteId = noteElement.dataset.noteId;
                    const noteIndex = MusicMaker.state.tracks.findIndex(n => n.id == noteId);
                    if (noteIndex > -1) {
                        MusicMaker.state.tracks.splice(noteIndex, 1);
                    }
                    noteElement.remove();
                });
            } else {
                const noteId = clickedNote.dataset.noteId;
                const noteIndex = MusicMaker.state.tracks.findIndex(n => n.id == noteId);
                if (noteIndex > -1) {
                    MusicMaker.state.tracks.splice(noteIndex, 1);
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
        const resizeHandleWidth = 5;

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

        if (e.shiftKey) {
            noteElement.classList.toggle('selected');
        } else {
            if (!noteElement.classList.contains('selected')) {
                document.querySelectorAll('.note.selected').forEach(n => n.classList.remove('selected'));
                noteElement.classList.add('selected');
            }
        }
        MusicMaker.updateSelectorToSelection();

        const initialX = e.pageX;
        const isResizing = noteElement.style.cursor === 'e-resize' || noteElement.style.cursor === 'w-resize';
        let durationTooltip = null;

        if (isResizing) {
            durationTooltip = document.createElement('div');
            durationTooltip.id = 'duration-tooltip';
            document.body.appendChild(durationTooltip);
        }

        if (noteElement.classList.contains('selected') && !isResizing) {
            const selectedNotes = Array.from(document.querySelectorAll('.note.selected'));
            const initialPositions = selectedNotes.map(n => ({ el: n, left: n.offsetLeft, note: MusicMaker.state.tracks.find(nt => nt.id == n.dataset.noteId) }));

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
            const initialLeft = noteElement.offsetLeft;
            const initialWidth = noteElement.offsetWidth;
            const noteObject = MusicMaker.state.tracks.find(n => n.id == note.id);

            const isResizingRight = noteElement.style.cursor === 'e-resize';
            const isResizingLeft = noteElement.style.cursor === 'w-resize';

            function onMouseMove(moveEvent) {
                const dx = moveEvent.pageX - initialX;
                let newLeft = initialLeft;
                let newWidth = initialWidth;
                const positionGridSizePixels = 0.25 * stepWidth;

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
                    const gridSizePixels = GRID_TIME_UNIT * stepWidth;
                    const snappedLeft = Math.round(newLeft / gridSizePixels) * gridSizePixels;
                    const snapTolerance = 4;
                    if (Math.abs(newLeft - snappedLeft) < snapTolerance) {
                        newLeft = snappedLeft;
                    }
                }

                if (durationTooltip) {
                    const duration = newWidth / stepWidth;
                    durationTooltip.textContent = `Duration: ${duration.toFixed(2)}`;
                    durationTooltip.style.left = moveEvent.pageX + 15 + 'px';
                    durationTooltip.style.top = moveEvent.pageY + 15 + 'px';
                }

                if (newLeft < 0) newLeft = 0;
                
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
                        if (newWidth > 0) noteElement.style.width = newWidth + 'px';
                    } else if (isResizingLeft) {
                        if (newWidth > 0) {
                            noteElement.style.left = newLeft + 'px';
                            noteElement.style.width = newWidth + 'px';
                        }
                    } else {
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
    MusicMaker.state.tracks.forEach(note => MusicMaker.renderNote(note));
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
    MusicMaker.state.trackLayout = layout;
    MusicMaker.state.collapseState = collapseState;
    return { layout, collapseState };
};

MusicMaker.comparePitches = function(pitchA, pitchB) {
    const indexA = MusicMaker.ALL_PITCH_NAMES.indexOf(pitchA);
    const indexB = MusicMaker.ALL_PITCH_NAMES.indexOf(pitchB);
    return indexB - indexA;
};

MusicMaker.updateSelectorToSelection = function() {
    const selector = document.getElementById('instrument-selector');
    const selectedNoteElements = document.querySelectorAll('.note.selected');

    if (selectedNoteElements.length === 0) {
        selector.value = '';
        return;
    }

    const selectedNotesData = [];
    selectedNoteElements.forEach(el => {
        const note = MusicMaker.state.tracks.find(n => String(n.id) === el.dataset.noteId);
        if (note) {
            selectedNotesData.push(note);
        }
    });

    if (selectedNotesData.length === 0) {
        selector.value = '';
        return;
    }

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
                    id: MusicMaker.nextNoteId++,
                    instrumentName: ghostNote.currentTimeline.dataset.instrument,
                    pitch: ghostNote.currentTimeline.parentElement.parentElement.dataset.pitch,
                    start: newStart,
                    duration: noteData.duration
                });
            }
        });

        newNotes.forEach(note => {
            MusicMaker.state.tracks.push(note);
            MusicMaker.renderNote(note);
            checkAndGrowTimeline(note);
        });

        MusicMaker.updateSongTotalTime();

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
    const remainingTimeInUnits = MusicMaker.state.songTotalTime - noteEndTimeInUnits;
    const thresholdInUnits = AUTOGROW_THRESHOLD_SECONDS / TIME_UNIT_TO_SECONDS;

    if (remainingTimeInUnits < thresholdInUnits) {
        const growAmountInUnits = AUTOGROW_AMOUNT_SECONDS / TIME_UNIT_TO_SECONDS;
        MusicMaker.state.songTotalTime += growAmountInUnits;
        updateTimelineWidth();
    }
}

function updateTimelineWidth() {
    const timelines = document.querySelectorAll('.timeline-col');
    const newWidth = MusicMaker.state.songTotalTime * stepWidth;
    timelines.forEach(timeline => {
        timeline.style.minWidth = newWidth + 'px';
        timeline.style.backgroundSize = stepWidth + 'px 100%';
        if (stepWidth < 5) {
            timeline.style.backgroundImage = 'none';
        } else {
            timeline.style.backgroundImage = 'linear-gradient(to right, #2a2a2a 2px, transparent 1px)';
        }
    });
    MusicMaker.drawTimelineRuler();
}

MusicMaker.setTempo = function(tempo) {
    const tempoSlider = document.getElementById('tempo-slider');
    const tempoValue = document.getElementById('tempo-value');
    if (tempoSlider) {
        tempoSlider.value = tempo;
        tempoValue.textContent = tempo;
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

    const songTotalTimeInSeconds = MusicMaker.state.songTotalTime * timeUnit;
    const pixelsPerSecond = stepWidth / timeUnit;

    let majorLabelStep = 1;
    if (pixelsPerSecond < 60) majorLabelStep = 2;
    if (pixelsPerSecond < 30) majorLabelStep = 5;
    if (pixelsPerSecond < 15) majorLabelStep = 10;
    if (pixelsPerSecond < 8) majorLabelStep = 20;
    if (pixelsPerSecond < 4) majorLabelStep = 60;

    let markerSubStep = 1;
    if (pixelsPerSecond >= 100) markerSubStep = 2;
    if (pixelsPerSecond >= 200) markerSubStep = 4;
    if (pixelsPerSecond >= 400) markerSubStep = 8;

    const increment = 1 / markerSubStep;

    for (let i = 0; i < songTotalTimeInSeconds; i += increment) {
        const leftPosition = (i / timeUnit) * stepWidth;
        const marker = document.createElement('div');
        marker.className = 'time-marker';

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
        } else if (isHalfTick && pixelsPerSecond >= 200) {
            marker.style.height = '60%';
            marker.style.borderLeft = '1px solid #777';
            labelText = i.toFixed(2);
        } else {
            marker.style.height = '50%';
            marker.style.borderLeft = '1px solid #666';
            if (markerSubStep >= 4 && pixelsPerSecond >= 400) {
                 labelText = i.toFixed(2);
            }
        }

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
