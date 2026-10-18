# Smart Garden IoT System (Hệ thống Vườn cây Thông minh)

Mô hình hệ thống IoT giám sát và tự động điều khiển vườn cây thông minh sử dụng vi điều khiển ESP32, giao thức truyền thông MQTT và giao diện Web Dashboard theo thời gian thực[cite: 7, 8, 11].

---

## Thành viên nhóm 5 (Lớp 22DT1 / 22DT5 - Trường Đại học Bách khoa - Đại học Đà Nẵng)
* **Giảng viên hướng dẫn:** TS. Văn Phú Tuấn[cite: 4]
* **Thành viên tham gia:**
  * Đặng Văn Thịnh (22DT1)[cite: 4]
  * Hồ Văn Trung (22DT1)[cite: 4]
  * Nguyễn Tâm Vũ (22DT1)[cite: 4]
  * Phan Thị Hoàng Ngân (22DT1)[cite: 4]
  * Lưu Trần Hồng Khuyên (22DT5)[cite: 4]

---

## Giới thiệu dự án
Đề tài được thực hiện nhằm giải quyết nhu cầu tự động hóa chăm sóc cây trồng, giảm thiểu thời gian và tiết kiệm nước so với phương pháp thủ công[cite: 7]. Hệ thống cho phép:
* **Theo dõi môi trường thời gian thực:** Cập nhật liên tục các thông số về nhiệt độ, độ ẩm không khí, độ ẩm đất và cường độ ánh sáng[cite: 7].
* **Tự động hóa thông minh:** Tự động kích hoạt máy bơm khi đất khô, bật quạt khi nhiệt độ cao, hoặc bật đèn khi thiếu ánh sáng dựa trên các ngưỡng cài đặt[cite: 7, 10].
* **Điều khiển từ xa:** Giám sát và bật/tắt thiết bị thủ công qua Web Dashboard thông qua giao thức MQTT[cite: 7, 11].

---

## 🖼️ Hình ảnh mô hình thực tế

<!-- DÁN ĐOẠN MÃ ẢNH MÔ HÌNH VÀO DƯỚI DÒNG NÀY --> <img width="966" height="528" alt="Báo cáo HTN" src="https://github.com/user-attachments/assets/fb702820-22f6-4764-a5ff-71448014f17d" />
![Mô hình thực tế](DÁN_LINK_ẢNH_MÔ_HÌNH_VÀO_ĐÂY)

---

## 📊 Giao diện Web Dashboard

<!-- DÁN ĐOẠN MÃ ẢNH DASHBOARD VÀO DƯỚI DÒNG NÀY --> <img width="690" height="450" alt="Báo cáo HTN (1)" src="https://github.com/user-attachments/assets/0c4c087c-556c-4fb3-8ccf-2af937fa25e5" />
![Web Dashboard](DÁN_LINK_ẢNH_DASHBOARD_VÀO_ĐÂY)

---

## Sơ đồ khối hệ thống

```text
[ Cảm biến độ ẩm đất ] ──┐
[ Cảm biến DHT11    ] ──┼──> [ Vi điều khiển ESP32 ] ──> [ Màn hình LCD 16x2 ]
[ Cảm biến ánh sáng ] ──┘          │                         │
                                   ├──> [ Relay & Thiết bị ] ──> (Máy bơm, Quạt, Đèn)
                                   └──> [ Giao thức MQTT   ] ──> [ Web Dashboard ]
# Smart Garden IoT System (Hệ thống Vườn cây Thông minh)


Nhom5_HTN/
│
├── MQTT/
│   └── MQTT.ino         # Mã nguồn chính cho ESP32 kết nối Wi-Fi, đọc cảm biến và xử lý MQTT
├── testmqtt/
│   └── subscriber.js    # Script xử lý dữ liệu phía subscriber/web server
└── README.md
