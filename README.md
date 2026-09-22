# 🏫 VKU Field Survey PWA (Offline-First Campus Inspection)

> **Mini-Project 1: Học phần Phát triển ứng dụng đa nền tảng (Cross-Platform Application Development)**  
> **Trường Đại học Công nghệ Thông tin & Truyền thông Việt - Hàn (VKU)**

[![PWA Ready](https://img.shields.io/badge/PWA-100%25%20Offline--First-0054A6?style=for-the-badge&logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB%20Engine-FDB913?style=for-the-badge&logo=databricks&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
[![Capacitor Ready](https://img.shields.io/badge/Capacitor-Android%20Bridge%20Ready-1192E8?style=for-the-badge&logo=capacitor)](https://capacitorjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](LICENSE)

---

## 🎯 Mục Tiêu Dự Án (Project Goal)
Xây dựng ứng dụng **Progressive Web App (PWA)** phục vụ công tác kiểm định, khảo sát cơ sở vật chất (CSVC) tại các phòng học, phòng Lab, ký túc xá, thư viện trường VKU với khả năng hoạt động **100% khi mất hoàn toàn kết nối mạng (Zero Network Connectivity)**. 

Toàn bộ dữ liệu biên bản, hình ảnh chụp thực địa và tọa độ GPS khuôn viên được lưu trữ an toàn trong **IndexedDB**, tự động đưa vào hàng đợi đồng bộ (**Sync Queue**) và tự động đẩy lên Cloud ngay khi có kết nối mạng trở lại.

---

## 🚀 Tính Năng Nổi Bật (Key Features)

- 📶 **100% Offline-First Architecture**: Tải và vận hành trơn tru mọi chức năng khi thiết bị mất sóng hoặc ở chế độ máy bay (Airplane Mode).
- 💾 **Native IndexedDB Persistence**: Lưu trữ phi cấu trúc các biên bản kiểm tra, ảnh Base64 và thông tin cán bộ mà không cần phụ thuộc thư viện ngoài.
- 🔄 **Smart Sync Queue & State Machine**: Theo dõi mạng theo thời gian thực (Online/Offline events), tự động đẩy dữ liệu lên máy chủ và cập nhật trạng thái `synced`.
- 📸 **Offline Camera & In-Memory Compression**: Tự động co giãn và nén ảnh chụp hiện trường bằng Canvas 2D, đóng dấu Watermark thời gian kiểm định, giảm dung lượng ảnh từ 10MB xuống <250KB.
- 📍 **GPS Geolocation & VKU Campus Zone Mapper**: Sử dụng Geolocation API kết hợp công thức Haversine để tự động nhận diện phân khu (Khu Giảng đường A, Tòa nhà V, Tòa K, KTX K1/K2, Thư viện số, Sân vận động).
- 📊 **Thống kê & Bảng điều khiển (Dashboard)**: Theo dõi tỷ lệ thiết bị đạt chuẩn, cần bảo trì, hỏng khẩn cấp và mật độ sự cố theo từng tòa nhà.
- 📑 **Xuất dữ liệu & Báo cáo đa định dạng**: Hỗ trợ xuất file Excel (CSV chuẩn UTF-8 BOM), sao lưu dữ liệu JSON và in biên bản trực tiếp (Print to PDF).
- 📲 **Sẵn sàng đóng gói Android APK**: Cấu hình `capacitor.config.json` sẵn sàng cho kế hoạch tuần tới (Wrapping into Android APK via Capacitor Bridge).

---

## 🏗️ Kiến Trúc Hệ Thống (System Architecture)

```
Mini-Project1/
├── index.html                 # Giao diện chính responsive theo nhận diện thương hiệu VKU
├── manifest.json              # Khai báo PWA (Standalone, theme #0054A6, Icons đa kích thước)
├── sw.js                      # Service Worker quản lý bộ đệm Cache Storage & Background Sync
├── css/
│   ├── style.css              # Design tokens (Màu VKU Blue, Gold, Crimson), Dark mode, Safe Area
│   └── components.css         # Form, severity chips, widget ảnh, GPS badge, dashboard
├── js/
│   ├── db.js                  # Lớp CSDL IndexedDB (VKU_FieldSurvey_DB) quản lý CRUD & export
│   ├── sync.js                # Quản lý trạng thái mạng, hàng đợi đồng bộ và mock cloud API
│   ├── camera.js              # Nén ảnh Canvas 2D, đóng dấu bản quyền thời gian kiểm định
│   ├── geo.js                 # HTML5 Geolocation & Nhận diện phân khu VKU (Haversine Formula)
│   ├── ui.js                  # Điều khiển DOM, phân trang, lọc hồ sơ, modal chi tiết
│   └── app.js                 # Bootstrap ứng dụng, đăng ký SW và xử lý cài đặt PWA
├── assets/icons/              # Bộ icons PWA chuẩn (192x192, 512x512, maskable, SVG)
├── report/
│   ├── report.html            # Báo cáo kỹ thuật in/xuất PDF chuẩn khổ giấy A4 (2–4 trang)
│   └── report.md              # Mã nguồn báo cáo kỹ thuật dạng Markdown
├── capacitor.config.json      # Cấu hình cầu nối Capacitor Android cho tuần tới
├── vercel.json                # Cấu hình triển khai Vercel với PWA headers
└── package.json               # Script chạy môi trường phát triển Vite & icon generator
```

---

## ⚡ Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Quick Start)

### 1. Yêu cầu môi trường
- Đã cài đặt **Node.js** (phiên bản 18+ trở lên) và **npm**.
- Trình duyệt web hiện đại (Google Chrome, Microsoft Edge, Safari, Firefox).

### 2. Các bước khởi chạy
```bash
# 1. Cài đặt các gói phụ thuộc (Vite dev server)
npm install

# 2. Khởi chạy máy chủ phát triển
npm run dev
```

Truy cập địa chỉ hiển thị trên terminal: `http://localhost:5173`

---

## 🌐 Hướng Dẫn Triển Khai Trực Tuyến HTTPS (Deployment Guide)

### Cách 1: Triển khai lên Vercel (Khuyên dùng)
1. Cài đặt Vercel CLI (nếu chưa có):
   ```bash
   npm i -g vercel
   ```
2. Đăng nhập và triển khai dự án trực tiếp:
   ```bash
   vercel
   ```
   *(Nhấn Enter qua các câu hỏi mặc định, tệp `vercel.json` sẽ tự động cấu hình PWA headers)*
3. Triển khai bản sản phẩm (Production):
   ```bash
   vercel --prod
   ```

### Cách 2: Triển khai lên Cloudflare Pages
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages**.
2. Chọn **Create Application** > **Pages** > **Connect to Git** (Chọn kho chứa GitHub của bạn).
3. Cấu hình Build settings:
   - **Framework preset**: None
   - **Build command**: Để trống (hoặc `npm run build`)
   - **Build output directory**: `.` (hoặc `dist`)
4. Bấm **Save and Deploy**. Cloudflare sẽ cung cấp đường link HTTPS miễn phí, tự động cấp phát chứng chỉ SSL (bắt buộc cho Service Worker PWA).

---

## 📱 Kế Hoạch Tuần Tới: Đóng Gói Thành Android APK Bằng Capacitor Bridge

Dự án đã được cấu hình sẵn tệp `capacitor.config.json` và hỗ trợ đầy đủ `viewport-fit=cover`, safe-area-insets. Khi thực hiện đóng gói sang Android vào tuần tới, chỉ cần chạy các lệnh sau:

```bash
# 1. Cài đặt gói thư viện Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Thêm nền tảng Android
npx cap add android

# 3. Đồng bộ tài nguyên Web vào thư mục Android native
npx cap sync

# 4. Mở Android Studio để Build file APK
npx cap open android
```

---

## 📄 Báo Cáo Kỹ Thuật (Technical Report)

Báo cáo kỹ thuật chi tiết độ dài 2–4 trang đã được biên soạn theo chuẩn học thuật của VKU:
- **Xem trực tiếp & In ra PDF A4**: Mở tệp [report/report.html](./report/report.html) trên trình duyệt và bấm nút **"🖨️ In Báo Cáo / Xuất PDF (A4)"**.
- **Xem văn bản Markdown**: Đọc tệp [report/report.md](./report/report.md).

---

## 👥 Nhóm Thực Hiện
- **Học phần**: Phát triển ứng dụng đa nền tảng
- **Đơn vị**: Khoa Kỹ thuật Máy tính & Điện tử, Trường Đại học CNTT & TT Việt - Hàn (VKU)
- **Email**: sinhvien@vku.udn.vn
