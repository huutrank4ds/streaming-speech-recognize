import asyncio
import websockets
from google.cloud import speech
import os
import json # Thêm thư viện json
import argparse

parser = argparse.ArgumentParser(description="Streaming Speech Recognize Server")
parser.add_argument(
    "--key", 
    type=str, 
    default=".env.json",
    help="Path to Google Cloud service account JSON key"
)
parser.add_argument(
    "--port", 
    type=int, 
    default=8000,
    help="Port to run the WebSocket server"
)
args = parser.parse_args()

# --- LƯU Ý BẢO MẬT ---
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = args.key

HOST = "localhost"
PORT = args.port
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

    audio_queue = asyncio.Queue()
    recognizing = None

    async def request_generator():
        yield speech.StreamingRecognizeRequest(streaming_config=streaming_config)
        try:
            while True:
                audio_chunk = await audio_queue.get() # Chờ audio từ Queue
                if audio_chunk is None: # Tín hiệu dừng
                    break
                yield speech.StreamingRecognizeRequest(audio_content=audio_chunk)
                audio_queue.task_done()
        except websockets.exceptions.ConnectionClosedError:
            print("Connection closed by client.")
        except Exception as e:
            print(f"Error receiving audio from client: {e}")

    async def recognize_task():
        nonlocal recognizing
        try:
            responses = await client.streaming_recognize(requests=request_generator())
            async for response in responses:
                if not response.results:
                    continue
                result = response.results[0]
                if not result.alternatives:
                    continue
                transcript = result.alternatives[0].transcript
                is_final = result.is_final
                message = {
                    "transcript": transcript,
                    "is_final": is_final
                }
                await websocket.send(json.dumps(message))
        except Exception as e:
            print(f"Error during streaming recognition: {e}")
        finally:
            recognizing = None
            print("Streaming recognition finished.")
    try:
        async for message in websocket:
            if isinstance(message, str):
                try:
                    msg_data = json.loads(message)
                    if isinstance(msg_data, dict) and "command" in msg_data:
                        command = msg_data["command"]
                        if command == "start_recognition":
                            if recognizing is None or recognizing.done():
                                recognizing = asyncio.create_task(recognize_task())
                        elif command == "stop_recognition":
                            if recognizing and not recognizing.done():
                                await audio_queue.put(None)
                except json.JSONDecodeError:
                    print("Invalid JSON received!")
            elif isinstance(message, bytes):
                if recognizing and not recognizing.done():
                    await audio_queue.put(message)
            else:
                print(f"Received unknown message type: {type(message)}")
    finally:
        print(f"Client disconnected: {websocket.remote_address}")
        if recognizing and not recognizing.done():
            print("Client disconnected, putting stop signal in audio_queue for GCP task.")
            await audio_queue.put(None)
            try:
                # Cố gắng chờ task kết thúc, nhưng đặt timeout để tránh treo
                await asyncio.wait_for(recognizing, timeout=5) 
            except asyncio.TimeoutError:
                print("GCP recognition task did not stop gracefully within 5s after client disconnect.")
                recognizing.cancel() # Hủy task nếu nó không chịu dừng
                try:
                    await recognizing # Chờ task bị hủy hoàn toàn
                except asyncio.CancelledError:
                    pass
        elif recognizing: # Nếu task đã hoàn thành nhưng biến recognizing vẫn còn
            recognizing = None # Đảm bảo reset

async def main():
    print(f"Starting server on ws://{HOST}:{PORT}")
    async with websockets.serve(handler, HOST, PORT, 
                                ping_interval=20, 
                                ping_timeout=20):
        await asyncio.Future()
    

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped.")