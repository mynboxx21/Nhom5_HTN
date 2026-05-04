#include <WiFi.h>
#include <PubSubClient.h>
#include "DHT.h"
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include <freertos/queue.h>
#include <freertos/timers.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

#define WIFI_SSID "NhaTroMinh2"
#define WIFI_PASSWORD "chuminh55@"
//#define WIFI_SSID "Leo"
//#define WIFI_PASSWORD "yciw3294"
//#define WIFI_SSID "ThanhTrung"
//#define WIFI_PASSWORD "61baumac19@"

#define MQTT_SERVER "broker.emqx.io"
#define MQTT_PORT 1883
#define MQTT_SUB_TOPIC  "test/esp32/control"
#define MQTT_PUB_TOPIC  "test/esp32/control"

#define LED1_PIN 2       
#define FAN_PIN 15      
#define PUMP_PIN 4       
#define DHTPIN 25
#define DHTTYPE DHT11    
#define SOIL_PIN 34       
#define LDR_PIN 35        

DHT dht(DHTPIN, DHTTYPE);

WiFiClient espClient;
PubSubClient client(espClient);

String led01_status = "OFF";
String fan_status = "OFF";
String pump_status = "OFF";

SemaphoreHandle_t xSensorMutex;
SemaphoreHandle_t xPublishSemaphore;
QueueHandle_t xControlQueue;
TimerHandle_t xPublishTimer;

typedef enum {
  CMD_LED_ON,
  CMD_LED_OFF,
  CMD_FAN_ON,
  CMD_FAN_OFF,
  CMD_PUMP_ON,
  CMD_PUMP_OFF,
  CMD_PUMP_TOGGLE,
  CMD_UNKNOWN
} ControlCommand_t;

float global_t = 0.0;
float global_h = 0.0;
int global_soil = 0;
int global_lux = 0;

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

  String msg;
  for (unsigned int i = 0; i < length; i++) {
    msg += (char)message[i];
  }
  Serial.print("Raw Payload: ");
  Serial.println(msg);

  msg.trim();
  Serial.print("Trimmed Payload: ");
  Serial.println(msg);

  if (msg.length() > 0 && msg.charAt(0) == '{') { 
    Serial.println("Received JSON telemetry (ignored for control).");
    return;
  }
  Serial.println("end Received JSON telemetry");
  if (String(topic) == MQTT_SUB_TOPIC) {
    Serial.println("start if (String(topic) == MQTT_SUB_TOPIC");
    ControlCommand_t cmd = CMD_UNKNOWN;

    if (msg == "ON") {
      cmd = CMD_LED_ON;
    } else if (msg == "OFF") {
      cmd = CMD_LED_OFF;
    } else if (msg == "FAN_ON") {
      cmd = CMD_FAN_ON;
    } else if (msg == "FAN_OFF") {
      cmd = CMD_FAN_OFF;
    } else if (msg == "PUMP_ON") {
      cmd = CMD_PUMP_ON;
    } else if (msg == "PUMP_OFF") {
      cmd = CMD_PUMP_OFF;
    } else if (msg == "PUMP_TOGGLE") {
      cmd = CMD_PUMP_TOGGLE;
    } else {
      Serial.print("Unknown control message: ");
      Serial.println(msg);
    }

    if (cmd != CMD_UNKNOWN) {
      if (xQueueSend(xControlQueue, &cmd, 0) != pdPASS) {
        Serial.println("Failed to send command to queue!");
      }
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
      vTaskDelay(pdMS_TO_TICKS(1000));
    }
  }
}

void vPublishTimerCallback(TimerHandle_t xTimer) {
  xSemaphoreGive(xPublishSemaphore);
}

void vSensorTask(void *pvParameters) {
  while (1) {
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    
    int raw_soil = analogRead(SOIL_PIN);
    int soil = map(raw_soil, 4095, 0, 0, 100);
    if (soil < 0) soil = 0;
    if (soil > 100) soil = 100;

    int raw_lux = analogRead(LDR_PIN);
    int lux = map(raw_lux, 4095, 0, 0, 100);
    if (lux < 0) lux = 0;
    if (lux > 100) lux = 100;

    if (isnan(h) || isnan(t)) {
      Serial.println("Failed to read from DHT sensor!");
    } else {
      if (xSemaphoreTake(xSensorMutex, portMAX_DELAY) == pdTRUE) {
        global_t = t;
        global_h = h;
        global_soil = soil;
        global_lux = lux;
        xSemaphoreGive(xSensorMutex);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(2000));
  }
}

void vControlTask(void *pvParameters) {
  ControlCommand_t cmd;
  while (1) {
    if (xQueueReceive(xControlQueue, &cmd, portMAX_DELAY) == pdPASS) {
      switch (cmd) {
        case CMD_LED_ON:      runLedOn(); break;
        case CMD_LED_OFF:     runLedOff(); break;
        case CMD_FAN_ON:      runFanOn(); break;
        case CMD_FAN_OFF:     runFanOff(); break;
        case CMD_PUMP_ON:     runPumpOn(); break;
        case CMD_PUMP_OFF:    runPumpOff(); break;
        case CMD_PUMP_TOGGLE:
          if (pump_status == "ON") runPumpOff(); else runPumpOn();
          break;
        default: break;
      }
      xSemaphoreGive(xPublishSemaphore);
    }
  }
}

void vPublishDisplayTask(void *pvParameters) {
  while (1) {
    if (xSemaphoreTake(xPublishSemaphore, portMAX_DELAY) == pdTRUE) {
      float t = 0, h = 0;
      int soil = 0, lux = 0;
      if (xSemaphoreTake(xSensorMutex, portMAX_DELAY) == pdTRUE) {
        t = global_t;
        h = global_h;
        soil = global_soil;
        lux = global_lux;
        xSemaphoreGive(xSensorMutex);
      }
      char t_str[8];
      char h_str[8];
      if (!isnan(t) && t != 0.0) {
        dtostrf(t, 4, 1, t_str);
      } else {
        strcpy(t_str, "--.-");
      }
      if (!isnan(h) && h != 0.0) {
        dtostrf(h, 4, 1, h_str);
      } else {
        strcpy(h_str, "--.-");
      }

      char buf1[17];
      char buf2[17];
      snprintf(buf1, sizeof(buf1), "T:%sC H:%s%%", t_str, h_str);
      snprintf(buf2, sizeof(buf2), "S:%3d%% L:%3d%%", soil, lux);

      lcd.setCursor(0,0);
      lcd.print(buf1);
      int len1 = strlen(buf1);
      for (int i = len1; i < 16; i++) lcd.print(' ');

      lcd.setCursor(0,1);
      lcd.print(buf2);
      int len2 = strlen(buf2);
      for (int i = len2; i < 16; i++) lcd.print(' ');

      if (client.connected()) {
        char payload[256];
        snprintf(payload, sizeof(payload),
                 "{\"temperature\": %.2f, \"humidity\": %.2f, \"lux_status\": %d, \"soil_moisture\": %d, \"led_01\": \"%s\", \"fan\": \"%s\", \"pump\": \"%s\"}",
                 (t == 0.0) ? -999.0 : t,
                 (h == 0.0) ? -999.0 : h,
                 lux, soil,
                 led01_status.c_str(),
                 fan_status.c_str(),
                 pump_status.c_str());

        if (client.publish(MQTT_PUB_TOPIC, payload)) {
          Serial.print("Published: ");
          Serial.println(payload);
        } else {
          Serial.println("Publish failed");
        }
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(SOIL_PIN, INPUT);
  pinMode(LDR_PIN, INPUT);

  pinMode(LED1_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(PUMP_PIN, OUTPUT);

  digitalWrite(LED1_PIN, LOW);
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(PUMP_PIN, LOW);

  dht.begin();
Wire.begin(21, 22); 
lcd.init();
lcd.backlight();
lcd.clear();

lcd.setCursor(0,0);
lcd.print("Smart Garden");
lcd.setCursor(0,1);
lcd.print("Init...");
vTaskDelay(pdMS_TO_TICKS(800));
lcd.clear();
  analogReadResolution(12);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    vTaskDelay(pdMS_TO_TICKS(500));
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi connected");

  client.setServer(MQTT_SERVER, MQTT_PORT);
  client.setCallback(callback);

  reconnect();

  xSensorMutex = xSemaphoreCreateMutex();
  xPublishSemaphore = xSemaphoreCreateBinary();
  xControlQueue = xQueueCreate(10, sizeof(ControlCommand_t));

  xPublishTimer = xTimerCreate("PubTimer", pdMS_TO_TICKS(5000), pdTRUE, (void *)0, vPublishTimerCallback);

  if (xSensorMutex != NULL && xPublishSemaphore != NULL && xControlQueue != NULL && xPublishTimer != NULL) {
    xTimerStart(xPublishTimer, 0);

    xTaskCreate(vSensorTask, "SensorTask", 2048, NULL, 1, NULL);
    xTaskCreate(vControlTask, "ControlTask", 2048, NULL, 2, NULL);
    xTaskCreate(vPublishDisplayTask, "PubDispTask", 4096, NULL, 1, NULL);
  } else {
    Serial.println("FreeRTOS initialization failed!");
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  vTaskDelay(pdMS_TO_TICKS(10));
}
