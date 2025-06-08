function getRandomNote() {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return notes[Math.floor(Math.random() * notes.length)];
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export { getRandomNote, formatTime, clamp };