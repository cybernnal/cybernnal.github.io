let tracks = [];
let songTotalTime = 0;
let stepWidth = 20; // 1 duration unit = 20 pixels
const TIME_UNIT_TO_MS = 100; // 1 duration unit = 100ms

document.addEventListener('DOMContentLoaded', () => {
    MusicMaker.createUI();

    document.getElementById('importBtn').addEventListener('click', MusicMaker.importTracks);
    document.getElementById('exportBtn').addEventListener('click', () => {
        MusicMaker.exportTracks({ tracks: tracks, totalTime: songTotalTime });
    });

    const appContainer = document.getElementById('app-container');
    let isPanning = false;
    let startX, startY;
    let scrollLeft, scrollTop;

    appContainer.addEventListener('mousedown', (e) => {
        if (e.button !== 2) return; // only right-click
        isPanning = true;
        startX = e.pageX - appContainer.offsetLeft;
        startY = e.pageY - appContainer.offsetTop;
        scrollLeft = appContainer.scrollLeft;
        scrollTop = appContainer.scrollTop;
        appContainer.style.cursor = 'grabbing';
    });

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
});
