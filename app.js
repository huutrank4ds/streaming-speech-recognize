// Client-side JS for real-time speech-to-text
let ws;
let audioContext;
let processor;
let input;
let stream;
let isRecording = false;

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');    
const transcriptDiv = document.getElementById('transcript');

function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8000');
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
        statusDiv.textContent = 'Trạng thái: Đã kết nối';
        startButton.disabled = false;
    };
    ws.onmessage = (event) => {
        transcriptDiv.textContent = event.data;
    };
    ws.onclose = () => {
        statusDiv.textContent = 'Trạng thái: Đã ngắt kết nối';
        startButton.disabled = true;
        stopButton.disabled = true;
    };
    ws.onerror = (err) => {
        statusDiv.textContent = 'Lỗi WebSocket';
        console.error('WebSocket error:', err);
    };
}

connectWebSocket();

function floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

async function startRecording() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    input = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
        if (!isRecording) return;
        const data = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(data);
        ws.send(pcmData.buffer);
    };

    input.connect(processor);
    processor.connect(audioContext.destination);
    isRecording = true;
    startButton.disabled = true;
    stopButton.disabled = false;
}

function stopRecording() {
    isRecording = false;
    if (processor) {
        processor.disconnect();
        processor.onaudioprocess = null;
    }
    if (input) input.disconnect();
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    startButton.disabled = false;
    stopButton.disabled = true;
}

startButton.addEventListener('click', startRecording);
stopButton.addEventListener('click', stopRecording);
