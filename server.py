import asyncio
import websockets
from google.cloud import speech
import os
import json # Thêm thư viện json

# --- LƯU Ý BẢO MẬT ---
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = ".env.json"

HOST = "localhost"
PORT = 8000
LANGUAGE_CODE = "vi-VN"
SAMPLE_RATE = 16000

async def handler(websocket, path):
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
        responses = await client.streaming_recognize(requests=request_generator())
        async for response in responses:
            if not response.results:
                continue
            result = response.results[0]
            if not result.alternatives:
                continue
            
            # Lấy transcript và cờ is_final
            transcript = result.alternatives[0].transcript
            is_final = result.is_final

            # Tạo một dictionary và chuyển nó thành chuỗi JSON để gửi đi
            message = {
                "transcript": transcript,
                "is_final": is_final
            }
            await websocket.send(json.dumps(message))

    except Exception as e:
        print(f"Error during streaming recognition: {e}")
    finally:
        print(f"Client disconnected: {websocket.remote_address}")

async def main():
    print(f"Starting server on ws://{HOST}:{PORT}")
    async with websockets.serve(handler, HOST, PORT, ping_interval=20, ping_timeout=20):
        await asyncio.Future()
    

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped.")