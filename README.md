# 🎤 Streaming Speech Recognize (Google Cloud Speech-to-Text)

[![Python](https://img.shields.io/badge/Python-3.x-informational)](https://www.python.org/)
[![Google Cloud](https://img.shields.io/badge/Google%20Cloud-Speech--to--Text-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/speech-to-text)
![Status](https://img.shields.io/badge/status-demo-success)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)

Ứng dụng demo **Streaming Speech-to-Text** sử dụng **Google Cloud Speech-to-Text API** để chuyển giọng nói thành văn bản theo thời gian thực qua giao diện web và server Python.

---

## 📚 Mục lục
- [✨ Tính năng](#-tính-năng)
- [✅ Yêu cầu](#-yêu-cầu)
- [☁️ Chuẩn bị Google Cloud API](#️-chuẩn-bị-google-cloud-api)
- [📦 Cài đặt & Chạy](#-cài-đặt--chạy)
- [🧩 Cấu hình server](#-cấu-hình-server)
- [🛠️ Troubleshooting](#️-troubleshooting)

---

## ✨ Tính năng
- 🎙️ Nhận diện giọng nói **thời gian thực**.
- ☁️ Sử dụng **Google Cloud Speech-to-Text API**.
- 🌐 Giao diện web đơn giản, mở bằng **Live Server**.
- 🐍 Server Python nhẹ, dễ cấu hình.

---

## ✅ Yêu cầu
- Tài khoản **Google Cloud** và một **project** đã bật billing.
- File **Service Account JSON** (tải về trong bước chuẩn bị).
- **Python 3.x**, **pip**.
- **VS Code** với extension **Live Server** (hoặc web server tương đương).
- Microphone và trình duyệt hiện đại (khuyến nghị Chrome).

---

## ☁️ Chuẩn bị Google Cloud API

1. **Enable API**
   - Vào **APIs & Services** → **Enable APIs and services**.  
   - Tìm **Speech-to-Text API**.  
   - Chọn **Cloud Speech-to-Text API**.
   

2. **Tạo Credentials**
   - Chọn **Manage** để mở phần quản lý.  
   - Tạo **Service Account**.  
   - Tạo **Key** dạng **JSON** và **download** về máy.

> 🔒 **Lưu ý:** Giữ kín file JSON. Không commit lên Git.

---

## 📦 Cài đặt & Chạy

### 1) Clone mã nguồn
```bash
git clone https://github.com/huutrank4ds/streaming-speech-recognize.git
cd streaming-speech-recognize
``` 
### 2) Mở giao diện web
Mở **`index.html`** bằng **Live Server** trong VS Code  
(Right-click → **Open with Live Server**).
### 3) Chạy server Python
Xem mục **Cấu hình server** bên dưới để trỏ đúng tới file JSON.  
Sau đó chạy:
```bash
python server.py
```
## 🧩 Cấu hình server
```bash
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = ".env.json"

HOST = "localhost"
PORT = 8000
LANGUAGE_CODE = "vi-VN"
SAMPLE_RATE = 16000
```
Thay ".env.json" bằng đường dẫn tới **Service Account JSON**
Thay thế LANGUAGE_CODE bằng mã ngôn ngữ bạn cần.
## 🛠️ Troubleshooting
- 403 / permission denied: Kiểm tra Service Account có quyền Cloud Speech-to-Text và đường dẫn JSON đúng.
- Không nhận mic: Trình duyệt cần cấp quyền microphone; thử mở lại trang hoặc kiểm tra https/localhost.
- Không kết nối server: Kiểm tra server.py đang chạy và URL WebSocket/HTTP khớp với client.
