/* MQTT.ino - Smart Garden
   - Đọc DHT (temp, hum), soil moisture (ADC), light (LDR ADC)
   - Subscribe control topic để nhận lệnh ON/OFF
   - Publish JSON data gồm: temperature, humidity, lux_status, soil_moisture, led_01, led_02, pump
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include "DHT.h"
// Added for I2C LCD (16x2) - SDA = GPIO21, SCL = GPIO22 on ESP32 (30-pin)
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
// Common I2C address for PCF8574 backpacks: 0x27 or 0x3F. Adjust if your module is different.
LiquidCrystal_I2C lcd(0x27, 16, 2);

#define WIFI_SSID "NhaTroMinh2"
#define WIFI_PASSWORD "chuminh55@"
//#define WIFI_SSID "Leo"
//#define WIFI_PASSWORD "yciw3294"
//#define WIFI_SSID "ThanhTrung"
//#define WIFI_PASSWORD "61baumac19@"

#define MQTT_SERVER "broker.emqx.io"
#define MQTT_PORT 1883

// Topics
#define MQTT_SUB_TOPIC  "test/esp32/control" // nhận lệnh
#define MQTT_PUB_TOPIC  "test/esp32/control"    // publish dữ liệu (bạn có thể đổi thành control nếu muốn)

// Pins
#define LED1_PIN 2        // led_01
#define FAN_PIN 15       // led_02 (ví dụ)
#define PUMP_PIN 4        // (tuỳ nếu dùng)
#define DHTPIN 25
#define DHTTYPE DHT11     // sửa thành DHT22 nếu bạn dùng DHT22
#define SOIL_PIN 34       // ADC pin cho cảm biến độ ẩm đất
#define LDR_PIN 35        // ADC pin cho cảm biến ánh sáng (LDR)

DHT dht(DHTPIN, DHTTYPE);

WiFiClient espClient;
PubSubClient client(espClient);

// trạng thái thiết bị
String led01_status = "OFF";
String fan_status = "OFF";
String pump_status = "OFF"; /* ADDED */

void runLedOn() {
  digitalWrite(LED1_PIN, HIGH);
  led01_status = "ON";
  Serial.println("LED1 turned ON");
}

void runLedOff() {
  digitalWrite(LED1_PIN, LOW);
  led01_status = "OFF";
  Serial.println("LED1 turned OFF");
}

void runFanOn() {
  digitalWrite(FAN_PIN, LOW);
  fan_status = "ON";
  Serial.println("FAN turned ON");
}

void runFanOff() {
  digitalWrite(FAN_PIN, HIGH);
  fan_status = "OFF";
  Serial.println("FAN turned OFF");
}
void runPumpOn() {
  digitalWrite(PUMP_PIN, LOW);
  pump_status = "ON";
  Serial.println("PUMP turned ON");
}

void runPumpOff() {
  digitalWrite(PUMP_PIN, HIGH);
  pump_status = "OFF";
  Serial.println("PUMP turned OFF");
}

void callback(char* topic, byte* message, unsigned int length) {
  Serial.print("Message arrived on topic: ");
  Serial.println(topic);

  // Build incoming payload String
  String msg;
  for (unsigned int i = 0; i < length; i++) {
    msg += (char)message[i];
  }
  Serial.print("Raw Payload: ");
  Serial.println(msg);

  // ADDED: Trim whitespace / CRLF to avoid mismatches
  msg.trim(); /* ADDED */
  Serial.print("Trimmed Payload: ");
  Serial.println(msg); /* ADDED */

  // ADDED: If payload is JSON telemetry (starts with '{'), ignore for control.
  // Reason: your firmware publishes telemetry JSON to the same topic; avoid treating telemetry as control.
  if (msg.length() > 0 && msg.charAt(0) == '{') { /* ADDED */
    Serial.println("Received JSON telemetry (ignored for control)."); /* ADDED */
    // Optionally parse telemetry here (e.g., update some state) if desired.
    return; /* ADDED */
  } /* ADDED */
  Serial.println("end Received JSON telemetry");
  // Xử lý control: hỗ trợ "ON", "OFF" (LED1) và "PUMP1_ON"/"PUMP1_OFF", "PUMP_ON"/"PUMP_OFF"
  if (String(topic) == MQTT_SUB_TOPIC) {
    Serial.println("start if (String(topic) == MQTT_SUB_TOPIC");
    // NOTE: comparisons assume trimmed exact token, e.g. "PUMP_ON"
    if (msg == "ON") {
      runLedOn();
    } else if (msg == "OFF") {
      runLedOff();
    } else if (msg == "FAN_ON") {
      runFanOn();
    } else if (msg == "FAN_OFF") {
      runFanOff();
    }
    /* ADDED: xử lý máy bơm chính qua MQTT */
    else if (msg == "PUMP_ON") {
      runPumpOn();
    } else if (msg == "PUMP_OFF") {
      runPumpOff();
    } else if (msg == "PUMP_TOGGLE") {
      // toggle simple
      if (pump_status == "ON") runPumpOff(); else runPumpOn();
    }
    else {
      // Ngoài ra bạn có thể gửi JSON và parse (khuyến nghị dùng ArduinoJson nếu cần)
      Serial.print("Unknown control message: ");
      Serial.println(msg);
    }
    Serial.println("end if (String(topic) == MQTT_SUB_TOPIC");
  }
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "ESP32Client-" + String(random(0xffff), HEX);
    Serial.print("Attempting MQTT connection...");
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
      client.subscribe(MQTT_SUB_TOPIC);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 2s");
      delay(1000);
    }
  }
}

unsigned long lastPublish = 0;
const unsigned long PUBLISH_INTERVAL = 5000; // 5s

void setup() {
  Serial.begin(115200);
  pinMode(SOIL_PIN, INPUT);
  pinMode(LDR_PIN, INPUT);

  pinMode(LED1_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(PUMP_PIN, OUTPUT);

  // đảm bảo trạng thái ban đầu
  digitalWrite(LED1_PIN, LOW);
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(PUMP_PIN, LOW);

  dht.begin();
// Initialize I2C for LCD and start LCD (SDA=21, SCL=22)
Wire.begin(21, 22); // SDA, SCL pins for ESP32
lcd.init();
lcd.backlight();
lcd.clear();
// Display a startup message briefly
lcd.setCursor(0,0);
lcd.print("Smart Garden");
lcd.setCursor(0,1);
lcd.print("Init...");
delay(800);
lcd.clear();


  // cấu hình ADC cho ESP32 (tùy điều chỉnh nếu cần)
  analogReadResolution(12); // 12-bit -> 0..4095
  // analogSetAttenuation(ADC_11db); // bạn có thể điều chỉnh attenuation nếu cần

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi connected");

  client.setServer(MQTT_SERVER, MQTT_PORT);
  client.setCallback(callback);

  reconnect();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastPublish >= PUBLISH_INTERVAL) {
    lastPublish = now;

    // đọc cảm biến
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    int raw = analogRead(SOIL_PIN);
    Serial.println(raw);
    // ESP32 ADC range ~0..4095
    // Một số cảm biến soil: wet -> thấp, dry -> cao => nên đảo chiều
    int soil = map(raw, 4095, 0, 0, 100); // invert
    if (soil < 0) soil = 0;
    if (soil > 100) soil = 100;

    raw = analogRead(LDR_PIN);
    Serial.println(raw);
    int lux = map(raw, 4095, 0, 0, 100); // LDR: tối -> cao điện trở -> raw small/big tùy nối, bạn có thể đổi mapping
    if (lux < 0) lux = 0;
    if (lux > 100) lux = 100;

    // nếu đọc bị lỗi, dht trả NAN
    if (isnan(h) || isnan(t)) {
      Serial.println("Failed to read from DHT sensor!");
    }
// === LCD update (replace current LCD block with this) ===
// Display on 16x2:
// Line1: T:xx.xC H:yy.y%
// Line2: S:zzz% L:qqq%
{
  char t_str[8];
  char h_str[8];
  // format temperature and humidity to 1 decimal using dtostrf
  if (!isnan(t)) {
    // dtostrf(value, minWidth, numDecimals, buffer)
    dtostrf(t, 4, 1, t_str);   // e.g. "30.2"
  } else {
    strcpy(t_str, "--.-");
  }
  if (!isnan(h)) {
    dtostrf(h, 4, 1, h_str);
  } else {
    strcpy(h_str, "--.-");
  }

  char buf1[17];
  char buf2[17];

  // Build first line: T:xx.xC H:yy.y%
  snprintf(buf1, sizeof(buf1), "T:%sC H:%s%%", t_str, h_str);

  // Soil and Light as integer percentages (already computed)
  int s_disp = soil;
  int l_disp = lux;
  snprintf(buf2, sizeof(buf2), "S:%3d%% L:%3d%%", s_disp, l_disp);

  // write to LCD and pad with spaces to clear old chars
  lcd.setCursor(0,0);
  lcd.print(buf1);
  int len1 = strlen(buf1);
  for (int i = len1; i < 16; i++) lcd.print(' ');

  lcd.setCursor(0,1);
  lcd.print(buf2);
  int len2 = strlen(buf2);
  for (int i = len2; i < 16; i++) lcd.print(' ');
}
// === End LCD update ===



    // Tạo JSON payload
    char payload[256]; /* ADDED: tăng buffer để chứa pump field */
    // include led statuses + pump
    snprintf(payload, sizeof(payload),
             "{\"temperature\": %.2f, \"humidity\": %.2f, \"lux_status\": %d, \"soil_moisture\": %d, \"led_01\": \"%s\", \"fan\": \"%s\", \"pump\": \"%s\"}",
             isnan(t) ? -999.0 : t,
             isnan(h) ? -999.0 : h,
             lux, soil,
             led01_status.c_str(),
             fan_status.c_str(),
             pump_status.c_str()); /* ADDED: include pump_status */

    // Publish lên topic data
    if (client.publish(MQTT_PUB_TOPIC, payload)) {
      Serial.print("Published: ");
      Serial.println(payload);
    } else {
      Serial.println("Publish failed");
    }
  }
}
