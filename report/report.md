# BÁO CÁO KỸ THUẬT: MINI-PROJECT 1
## XÂY DỰNG ỨNG DỤNG VKU FIELD SURVEY PWA (OFFLINE-FIRST)

**Học phần:** Phát triển ứng dụng đa nền tảng (Cross-Platform Application Development)  
**Trường:** Đại học Công nghệ Thông tin & Truyền thông Việt - Hàn (VKU)  
**Khoa:** Kỹ thuật Máy tính & Điện tử  
**Mục tiêu:** Biểu mẫu kiểm định và khảo sát cơ sở vật chất khuôn viên VKU hoạt động độc lập khi mất hoàn toàn kết nối mạng (Zero Connectivity).

---

## 1. TỔNG QUAN & TUYÊN BỐ BÀI TOÁN (PROBLEM STATEMENT)
Trong công tác quản lý và vận hành cơ sở vật chất (CSVC) tại trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn (VKU), việc kiểm tra định kỳ các phòng học, phòng thực hành Lab (Khu Giảng đường A, Tòa nhà V, Tòa K, Thư viện, Ký túc xá) thường diễn ra tại các khu vực tầng hầm, phòng kín hoặc vùng sóng di động / Wi-Fi chập chờn.

Các ứng dụng Web truyền thống yêu cầu kết nối mạng liên tục sẽ bị tê liệt, gây mất trắng dữ liệu khi người dùng bấm gửi form. **VKU Field Survey PWA** được xây dựng theo triết lý **Offline-First**, đảm bảo:
- Khởi chạy và vận hành 100% không cần kết nối mạng.
- Toàn bộ hồ sơ khảo sát, ảnh hiện trường và tọa độ GPS được lưu trữ tức thời vào **IndexedDB**.
- Cơ chế hàng đợi đồng bộ (**Sync Queue**) tự động đẩy dữ liệu lên máy chủ ngay khi thiết bị kết nối mạng trở lại.
- Dễ dàng cài đặt trực tiếp lên màn hình chính điện thoại (PWA Standalone) và sẵn sàng đóng gói thành file **Android APK** thông qua **Capacitor Bridge** vào tuần tiếp theo.

---

## 2. KIẾN TRÚC HỆ THỐNG & CÁC MODULE CHÍNH

Hệ thống được thiết kế theo cấu trúc modular, zero-runtime dependency:

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
│   ├── report.html            # Báo cáo kỹ thuật in/xuất PDF chuẩn khổ giấy A4
│   └── report.md              # Mã nguồn tài liệu báo cáo dạng Markdown
├── capacitor.config.json      # Cấu hình cầu nối Capacitor Android cho tuần tới
└── README.md                  # Hướng dẫn chi tiết triển khai Vercel, Cloudflare & đóng gói
```

---

## 3. KỸ THUẬT OFFLINE-FIRST: SERVICE WORKER & INDEXEDDB

### 3.1. Chiến Lược Caching Của Service Worker (`sw.js`)
- **Pre-caching App Shell:** Trong sự kiện `install`, toàn bộ tài nguyên cốt lõi (HTML, CSS, JS, icons) được lưu trước vào bộ nhớ đệm `vku-survey-v1.0.0`.
- **Cache-First cho Static Assets:** Đối với file CSS, JS, hình ảnh, Service Worker sẽ trả về tài nguyên từ bộ nhớ cache trước, giúp ứng dụng mở tức thì và hoạt động mượt mà khi ngoại tuyến.
- **Network-First với Cache Fallback cho Navigation:** Đảm bảo khi có mạng người dùng nhận được phiên bản mới nhất, nhưng khi mất mạng trình duyệt sẽ tự động lấy `index.html` đã cache, không xuất hiện màn hình báo lỗi mất mạng của trình duyệt.

### 3.2. Cấu Trúc Cơ Sở Dữ Liệu IndexedDB (`js/db.js`)
Cơ sở dữ liệu `VKU_FieldSurvey_DB` sử dụng Object Store `inspections` với khóa chính `id` ngẫu nhiên có định dạng `VKU-[timestamp]-[hash]`:
- `building`, `room`: Vị trí khuôn viên.
- `facilityCategory`, `facilityName`: Tên và hạng mục thiết bị kiểm định.
- `severity`: Đánh giá hiện trạng (`good` | `warning` | `critical`).
- `photos`: Mảng hình ảnh đã nén dưới dạng Data URL / Blob.
- `geo`: Vĩ độ, kinh độ, sai số và tên phân khu nhận diện tự động.
- `syncStatus`: Cờ trạng thái đồng bộ (`pending_sync` hoặc `synced`).

---

## 4. QUẢN LÝ ĐỒNG BỘ DỮ LIỆU & HÀNG ĐỢI (SYNC QUEUE)

1. Khi người dùng bấm **Lưu biên bản**, nếu thiết bị ngoại tuyến (Offline), bản ghi được lưu vào IndexedDB với cờ `pending_sync`.
2. Huy hiệu hiển thị số lượng biên bản chờ đồng bộ xuất hiện trên thanh tiêu đề màu vàng.
3. Khi thiết bị kết nối mạng trở lại (bắt sự kiện `window.addEventListener('online')` hoặc sự kiện `sync` của Service Worker):
   - `SyncManager` tự động quét các bản ghi mang cờ `pending_sync`.
   - Tiến hành đẩy lên máy chủ Cloud (giả lập độ trễ mạng thực tế 400–800ms).
   - Khi thành công, bản ghi được cập nhật cờ `synced` kèm thời gian `syncedAt`.
   - Giao diện phát thông báo Toast chúc mừng và xóa huy hiệu chờ đồng bộ.

---

## 5. TƯƠNG TÁC PHẦN CỨNG: CAMERA & GEOLOCATION

- **Nén ảnh tự động:** Ảnh chụp từ camera điện thoại thông minh thường nặng từ 5MB đến 15MB. Canvas 2D trong `camera.js` tự động resize ảnh về kích thước tối đa 1200x1200px với chất lượng JPEG 0.82, giảm dung lượng xuống dưới 280KB và in trực tiếp dòng đóng dấu bản quyền `VKU Audit: [Thời gian]` lên góc ảnh.
- **Định vị & Nhận diện phân khu:** Tọa độ GPS từ `navigator.geolocation` được đối chiếu với tọa độ các mốc của VKU (Khu Giảng đường A, Tòa V, Tòa K, KTX, Thư viện) thông qua công thức lượng giác *Haversine*, tự động điền tên khu vực vào biên bản khảo sát.

---

## 6. KẾ HOẠCH ĐÓNG GÓI CAPACITOR ANDROID APK CHO TUẦN TỚI

Dự án đã chuẩn bị sẵn sàng 100% để bọc (wrap) thành Android APK:
1. `capacitor.config.json` đã được tạo sẵn với cấu hình package id `vn.edu.vku.fieldsurvey`.
2. Giao diện có sẵn thanh điều hướng Mobile Bottom Nav và hỗ trợ biến `env(safe-area-inset-top)` cho màn hình điện thoại.
3. Các bước đóng gói tuần tới:
   ```bash
   # Bước 1: Cài đặt Capacitor
   npm install @capacitor/core @capacitor/cli @capacitor/android

   # Bước 2: Thêm nền tảng Android
   npx cap add android

   # Bước 3: Đồng bộ mã nguồn web sang Android project
   npx cap sync

   # Bước 4: Mở Android Studio để xuất file APK
   npx cap open android
   ```

---

## 7. KẾT LUẬN & ĐÁNH GIÁ KẾT QUẢ

Ứng dụng **VKU Field Survey PWA** đáp ứng hoàn hảo toàn bộ các yêu cầu của Mini-Project 1:
- Đảm bảo tính sẵn sàng Offline-First 100% với Service Worker và IndexedDB.
- Giao diện thân thiện, chuẩn nhận diện trường VKU, đầy đủ tính năng xuất báo cáo CSV/JSON và in ấn.
- Cấu trúc mã nguồn sạch sẽ, không phụ thuộc thư viện cồng kềnh, tối ưu hóa để đóng gói Android APK bằng Capacitor Bridge vào tuần tới.
