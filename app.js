// Client-side JS for real-time speech-to-text

let ws;
let audioContext;
let processor;
let input;
let stream;
let isRecording = false;
let isPaused = false;

const VAD_THRESHOLD = 0.01;

const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const resumeButton = document.getElementById('resumeButton');
const stopButton = document.getElementById('stopButton');
const clearButton = document.getElementById('clearButton');
const statusDiv = document.getElementById('status');
const finalTranscriptSpan = document.getElementById('final-transcript');
const interimTranscriptSpan = document.getElementById('interim-transcript');
const volumeLevel = document.getElementById('volumeLevel');

function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8000');

    ws.onopen = () => {
        statusDiv.textContent = 'Trạng thái: Đã kết nối';
        startButton.disabled = false;
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        stopButton.disabled = true;
    };
    
    ws.onmessage = (event) => {
        // Parse chuỗi JSON nhận được
        const result = JSON.parse(event.data);
        
        if (result.is_final) {
            // Nếu là kết quả cuối cùng
            // Nối nó vào phần văn bản đã xác nhận
            finalTranscriptSpan.textContent += result.transcript + ' ';
            // Xóa phần văn bản tạm thời
            interimTranscriptSpan.textContent = '';
        } else {
            // Nếu là kết quả tạm thời
            // Cập nhật (thay thế) phần văn bản tạm thời
            interimTranscriptSpan.textContent = result.transcript;
        }
    };

    ws.onclose = () => {
        statusDiv.textContent = 'Trạng thái: Đã ngắt kết nối';
        // startButton.disabled = true;
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        stopButton.disabled = true;
    };
    ws.onerror = (err) => {
        statusDiv.textContent = 'Lỗi WebSocket';
        console.error('WebSocket error:', err);
    };
}

connectWebSocket();

// Các hàm còn lại giữ nguyên
function floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

function updateVolumeMeter(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
    }
    let rms = Math.sqrt(sum / data.length);
    let percent = Math.min(100, Math.floor(rms * 200));
    volumeLevel.style.width = percent + '%';
}

async function startRecording() {
    // Đảm bảo kết nối WebSocket đã mở
    if (ws.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket chưa sẵn sàng, đang cố gắng kết nối lại...");
        connectWebSocket(); // Cố gắng kết nối lại
        // Chờ một chút để kết nối thiết lập (thêm delay hoặc dùng Promise)
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (ws.readyState !== WebSocket.OPEN) {
            statusDiv.textContent = 'Lỗi: Không thể kết nối WebSocket.';
            return;
        }
    }

    try {
        // Lấy quyền truy cập microphone
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        input = audioContext.createMediaStreamSource(stream);
        // ScriptProcessorNode sẽ gọi onaudioprocess định kỳ
        processor = audioContext.createScriptProcessor(4096, 1, 1); // bufferSize, numberOfInputChannels, numberOfOutputChannels

        processor.onaudioprocess = (e) => {
            if (!isRecording || isPaused) return; // Chỉ xử lý khi đang ghi âm và không tạm dừng
            
            const data = e.inputBuffer.getChannelData(0); // Lấy dữ liệu âm thanh từ kênh đầu tiên
            updateVolumeMeter(data); // Cập nhật thanh âm lượng

            // --- VAD (Voice Activity Detection) đơn giản để không gửi âm thanh im lặng ---
            let sumOfSquares = 0.0;
            for (let i = 0; i < data.length; i++) {
                sumOfSquares += data[i] * data[i];
            }
            const rms = Math.sqrt(sumOfSquares / data.length);

            if (rms > VAD_THRESHOLD) { // Chỉ gửi nếu âm lượng vượt ngưỡng VAD
                const pcmData = floatTo16BitPCM(data); // Chuyển đổi sang 16-bit PCM
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(pcmData.buffer); // Gửi dữ liệu qua WebSocket
                }
            }
        };

        input.connect(processor); // Kết nối đầu vào từ microphone đến bộ xử lý
        processor.connect(audioContext.destination); // Kết nối bộ xử lý đến đầu ra (không bắt buộc nhưng là luồng bình thường)

        isRecording = true;
        isPaused = false; // Đảm bảo không bị tạm dừng khi bắt đầu
        
        // Cập nhật trạng thái và nút trên giao diện
        startButton.disabled = true;
        pauseButton.disabled = false;
        resumeButton.disabled = true;
        stopButton.disabled = false;
        statusDiv.textContent = 'Trạng thái: Đang ghi âm...';

    } catch (error) {
        console.error('Lỗi khi truy cập microphone hoặc AudioContext:', error);
        statusDiv.textContent = 'Lỗi: Không thể truy cập microphone. Vui lòng kiểm tra quyền.';
        stopRecording(); // Đảm bảo dừng lại nếu có lỗi
    }
}

function stopRecording() {
    isRecording = false;
    isPaused = false;
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
    pauseButton.disabled = true;
    resumeButton.disabled = true;
    stopButton.disabled = true;
    statusDiv.textContent = 'Trạng thái: Đã dừng ghi âm';
    volumeLevel.style.width = '0%';
}

function pauseRecording() {
    if (isRecording && !isPaused) {
        isPaused = true;
        pauseButton.disabled = true;
        resumeButton.disabled = false;
        statusDiv.textContent = 'Trạng thái: Đang tạm dừng';
    }
}

function resumeRecording() {
    if (isRecording && isPaused) {
        isPaused = false;
        pauseButton.disabled = false;
        resumeButton.disabled = true;
        statusDiv.textContent = 'Trạng thái: Đang ghi âm...';
    }
}

function clearTranscript() {
    finalTranscriptSpan.textContent = '';
    interimTranscriptSpan.textContent = '';
}

startButton.addEventListener('click', startRecording);
pauseButton.addEventListener('click', pauseRecording);
resumeButton.addEventListener('click', resumeRecording);
stopButton.addEventListener('click', stopRecording);
clearButton.addEventListener('click', clearTranscript);