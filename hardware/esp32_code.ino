#include <WiFi.h>
#include <HTTPClient.h>

// Replace with your Wi-Fi and laptop IP address.
// Use the same network for ESP32 and laptop.
const char* WIFI_NAME = "Sahanna's F54";
const char* WIFI_PASSWORD = "Attackontitan";
const char* SERVER_URL = "https://sewer-watch.onrender.com/api/telemetry";
const char* NODE_ID = "M-01"; // Set M-01, M-02 or M-03 for each physical node.

const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
const int MQ4_PIN = 34;
const int MQ7_PIN = 35;
const int TURBIDITY_PIN = 32;

float readWaterLevelCm() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1;
  float distance = duration * 0.0343 / 2.0;
  // TODO: calibrate tank/manhole geometry to convert distance to water depth.
  return distance;
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT);
  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWi-Fi connected");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    float level = readWaterLevelCm();
    if (level >= 0) {
      int mq4 = analogRead(MQ4_PIN);
      int mq7 = analogRead(MQ7_PIN);
      int turbidity = analogRead(TURBIDITY_PIN);
      String body = "{\"node_id\":\"" + String(NODE_ID) +
        "\",\"water_level_cm\":" + String(level,1) +
        ",\"turbidity_raw\":" + String(turbidity) +
        ",\"methane_raw\":" + String(mq4) +
        ",\"co_raw\":" + String(mq7) +
        ",\"pipe_distance_m\":null,\"flow_lps\":null," +
        "\"temperature_c\":null,\"battery_pct\":null}";
      HTTPClient http; http.begin(SERVER_URL);
      http.addHeader("Content-Type","application/json");
      int code = http.POST(body);
      Serial.printf("POST status: %d\n", code);
      http.end();
    }
  }
  delay(5000);
}

/*
IMPORTANT HARDWARE NOTES:
- ESP32 GPIO is 3.3V. Never connect a 5V ultrasonic ECHO directly;
  use a correctly calculated voltage divider or level shifter.
- MQ-4/MQ-7 analog values are raw ADC counts, NOT ppm.
- Turbidity raw ADC is NOT NTU until calibrated against standards.
- Water-level conversion needs installation geometry and calibration.
- Prototype readings/thresholds are not a certified safety instrument.
*/
