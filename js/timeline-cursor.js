
MusicMaker.setupCursorEventListeners = function() {
    const timelineContainer = document.getElementById('timeline-container');
    const playbackCursor = document.getElementById('playback-cursor');

    let isDragging = false;

    playbackCursor.addEventListener('mousedown', (e) => {
        isDragging = true;
        playbackCursor.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const timelineRect = timelineContainer.getBoundingClientRect();
            const cursorX = e.clientX - timelineRect.left;
            const totalWidth = timelineContainer.scrollWidth;
            let newLeft = cursorX + timelineContainer.scrollLeft;

            if (newLeft < 0) {
                newLeft = 0;
            }
            if (newLeft > totalWidth) {
                newLeft = totalWidth;
            }

            playbackCursor.style.left = newLeft + 'px';

            const positionInBeats = newLeft / stepWidth;
            const tempo = parseInt(document.getElementById('tempo-slider').value, 10);
            const timeUnit = 0.05 * tempo;
            const positionInSeconds = positionInBeats * timeUnit;
            MusicMaker.Playback.seek(positionInSeconds);
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            playbackCursor.style.cursor = 'grab';
            document.body.style.cursor = 'default';
        }
    });
};
