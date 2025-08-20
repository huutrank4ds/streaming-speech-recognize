import asyncio
import websockets
from google.cloud import speech
import os

# --- LƯU Ý BẢO MẬT ---
# Cách làm tốt nhất là XÓA DÒNG NÀY và thiết lập biến môi trường trong terminal
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "resonant-craft-463109-s1-19cac4bf2f91.json"

HOST = "localhost"
PORT = 8000
LANGUAGE_CODE = "vi-VN"
SAMPLE_RATE = 16000

async def handler(websocket, path):
    """
    Xử lý kết nối WebSocket, nhận audio và gửi lại transcript.
    """
    print(f"Client connected: {websocket.remote_address}")

    client = speech.SpeechAsyncClient()
    
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=SAMPLE_RATE,
        language_code=LANGUAGE_CODE,
        enable_automatic_punctuation=True,
    )
    streaming_config = speech.StreamingRecognitionConfig(
        config=config,
        interim_results=True,
    )

    async def request_generator():
        yield speech.StreamingRecognizeRequest(streaming_config=streaming_config)
        try:
            async for message in websocket:
                yield speech.StreamingRecognizeRequest(audio_content=message)
        except websockets.exceptions.ConnectionClosedError:
            print("Connection closed by client.")
        except Exception as e:
            print(f"Error receiving audio from client: {e}")

    try:
        # --- THAY ĐỔI QUAN TRỌNG Ở ĐÂY ---
        # Chúng ta phải `await` lời gọi hàm để nhận về đối tượng async iterator
        responses = await client.streaming_recognize(requests=request_generator())

        # Bây giờ `responses` là một async iterator hợp lệ
        async for response in responses:
            if not response.results:
                continue
            result = response.results[0]
            if not result.alternatives:
                continue
            
            transcript = result.alternatives[0].transcript
            await websocket.send(transcript)

    except Exception as e:
        print(f"Error during streaming recognition: {e}")
    finally:
        print(f"Client disconnected: {websocket.remote_address}")

async def main():
    """Hàm chính để khởi động server."""
    print(f"Starting server on ws://{HOST}:{PORT}")
    async with websockets.serve(handler, HOST, PORT):
        await asyncio.Future()  # Chạy mãi mãi

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped.")