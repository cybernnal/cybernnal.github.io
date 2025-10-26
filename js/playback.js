var MusicMaker = MusicMaker || {};

class Playback {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.soundBuffer = null;
        this.instrumentBuffers = {};
        this.isPlaying = false;
        this.startTime = 0;
        this.playbackPosition = 0;
        this.rafId = null;
        this.playingSources = [];
        this.currentTempo = parseInt(document.getElementById('tempo-slider').value, 10);

        this.preGainNode = this.audioContext.createGain();
        this.preGainNode.gain.value = 0.5;
        this.gainNode = this.audioContext.createGain();
        this.preGainNode.connect(this.gainNode);

        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime);
        this.compressor.knee.setValueAtTime(30, this.audioContext.currentTime);
        this.compressor.ratio.setValueAtTime(4, this.audioContext.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);

        this.gainNode.connect(this.compressor);
        this.compressor.connect(this.audioContext.destination);

        console.log('Playback constructor called');
        this.loadSound('sound.ogg').then(buffer => this.soundBuffer = buffer);
        this.loadAllInstrumentSounds();
    }

    setVolume(volume) {
        this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }

    async loadSound(url) {
        try {
            console.log('Loading sound from:', url);
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('Sound loaded successfully:', audioBuffer);
            return audioBuffer;
        } catch (error) {
            console.error('Error loading sound:', error);
        }
    }

    async loadAllInstrumentSounds() {
        try {
            const response = await fetch('js/instrument-sounds.json');
            const instrumentSounds = await response.json();
            for (const instrument in instrumentSounds) {
                this.instrumentBuffers[instrument] = {};
                for (const size in instrumentSounds[instrument]) {
                    const url = instrumentSounds[instrument][size];
                    this.instrumentBuffers[instrument][size] = await this.loadSound(url);
                }
            }
        } catch (error) {
            console.error('Error loading instrument sounds:', error);
        }
    }

    noteToMidi(noteName) {
        const noteOffsetMap = {
            'F#': 0, 'F': -1, 'E': -2, 'D#': -3, 'D': -4, 'C#': -5, 'C': -6, 'B': -7, 'A#': -8, 'A': -9, 'G#': -10, 'G': -11, 'LF#': -12
        };
        const octaveName = noteName.replace(/[^0-9]/g, '');
        let octave = parseInt(octaveName, 10);
        let key = noteName.slice(0, -octaveName.length);

        const baseMidiFsharp0 = 18;
        const midi = baseMidiFsharp0 + octave * 12 + noteOffsetMap[key];
        console.log(`noteToMidi: noteName=${noteName}, key=${key}, octave=${octave}, midi=${midi}`);
        return midi;
    }


    calculatePlaybackRate(note, baseNoteName) {
        if (note.pitch.startsWith('Percussion')) {
            return 1;
        }
        const baseMidi = this.noteToMidi(baseNoteName);
        const targetMidi = this.noteToMidi(note.pitch);

        if (baseMidi === null || targetMidi === null) {
            return 1;
        }

        const semitoneDifference = targetMidi - baseMidi;
        const playbackRate = Math.pow(2, semitoneDifference / 12);
        console.log(`Note: ${note.pitch}, Target MIDI: ${targetMidi}, Base MIDI: ${baseMidi}, Playback Rate: ${playbackRate}`);
        return playbackRate;
    }

    play() {
        console.log('Play called');
        if (this.isPlaying) {
            return;
        }
        this.isPlaying = true;
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
            console.log('AudioContext resumed');
        }
        console.log('AudioContext state:', this.audioContext.state);
        this.startTime = this.audioContext.currentTime - this.playbackPosition;

        this.currentTempo = parseInt(document.getElementById('tempo-slider').value, 10);
        const timeUnit = 0.05 * this.currentTempo;

        MusicMaker.notes.forEach(note => {
            const instrumentName = note.instrumentName;
            const noteSize = MusicMaker.getNoteSize(note);
            let buffer = this.soundBuffer;
            let baseNote = 'F#3';

            if (this.instrumentBuffers[instrumentName] && this.instrumentBuffers[instrumentName][noteSize]) {
                buffer = this.instrumentBuffers[instrumentName][noteSize];
                const octave = parseInt(note.pitch.replace(/[^0-9]/g, ''), 10);
                baseNote = `F#${octave}`;
            }

            if (!buffer) {
                console.warn(`No buffer for instrument ${instrumentName} and size ${noteSize}`);
                return;
            }

            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.playbackRate.value = this.calculatePlaybackRate(note, baseNote);
            source.connect(this.preGainNode);

            const noteStartTimeInSeconds = note.start * timeUnit;
            const noteDurationInSeconds = note.duration * timeUnit;

            const noteStartTime = this.startTime + noteStartTimeInSeconds;
            const noteEndTime = noteStartTime + noteDurationInSeconds;

            if (noteEndTime > this.audioContext.currentTime) {
                const offset = Math.max(0, this.audioContext.currentTime - noteStartTime);
                source.start(Math.max(this.audioContext.currentTime, noteStartTime), offset);
                source.stop(noteEndTime);
                this.playingSources.push(source);
            }
        });

        this.rafId = requestAnimationFrame(this.update.bind(this));
    }

    pause() {
        console.log('Pause called');
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.playingSources.forEach(source => source.stop());
        this.playingSources = [];
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        MusicMaker.updateCursor(this.playbackPosition);
    }

    seek(positionInSeconds) {
        this.playbackPosition = positionInSeconds;
        if (this.isPlaying) {
            this.pause();
            this.play();
        }
        MusicMaker.updateCursor(this.playbackPosition);
    }

    update() {
        if (!this.isPlaying) return;

        const newTempo = parseInt(document.getElementById('tempo-slider').value, 10);
        if (newTempo !== this.currentTempo) {
            const oldTimeUnit = 0.05 * this.currentTempo;
            const positionInSeconds = this.audioContext.currentTime - this.startTime;
            const positionInBeats = positionInSeconds / oldTimeUnit;

            const newTimeUnit = 0.05 * newTempo;
            this.playbackPosition = positionInBeats * newTimeUnit;

            this.pause();
            this.play();
            return;
        }

        const timeUnit = 0.05 * this.currentTempo;
        const songTotalTimeInSeconds = songTotalTime * timeUnit;

        this.playbackPosition = this.audioContext.currentTime - this.startTime;
        MusicMaker.updateCursor(this.playbackPosition);

        if (this.playbackPosition >= songTotalTimeInSeconds) {
            this.pause();
            this.playbackPosition = 0;
            MusicMaker.updateCursor(0);
            document.getElementById('playBtn').textContent = 'Play';
            return;
        }

        this.rafId = requestAnimationFrame(this.update.bind(this));
    }
}

MusicMaker.Playback = new Playback();
