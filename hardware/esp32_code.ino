#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>

// Add the "DHT sensor library" by Adafruit in Arduino IDE Library Manager.
// Enter Wi-Fi credentials locally. Never commit real credentials to GitHub.
const char* WIFI_NAME = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL = "https://sewer-watch.onrender.com/api/telemetry";
const char* NODE_ID = "M-01"; // M-01, M-02 or M-03

// Agreed wiring map
const int PARTICLE_TRIG_PIN = 25;
const int PARTICLE_ECHO_PIN = 26;
const int WATER_TRIG_PIN = 18;
const int WATER_ECHO_PIN = 19;
const int DHT_PIN = 27;
const int FLOW_PIN = 32;       // ZJ-S201 yellow pulse wire
const int TURBIDITY_PIN = 33;  // AO
const int MQ4_PIN = 35;        // AO
const int MQ7_PIN = 34;        // AO

#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

volatile uint32_t flowPulses = 0;
portMUX_TYPE flowMux = portMUX_INITIALIZER_UNLOCKED;
const float FLOW_PULSES_PER_LITER = 450.0f; // Calibrate against a measured volume
const unsigned long SEND_INTERVAL_MS = 5000;
unsigned long lastSend = 0;
unsigned long lastFlowSample = 0;
float flowLps = 0.0f;

void IRAM_ATTR onFlowPulse() {
  portENTER_CRITICAL_ISR(&flowMux);
  flowPulses++;
  portEXIT_CRITICAL_ISR(&flowMux);
}

float readDistanceCm(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(3);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  unsigned long duration = pulseIn(echoPin, HIGH, 30000UL);
  if (duration == 0) return NAN;
  return (duration * 0.0343f) / 2.0f;
}

String jsonNumber(float value, int decimals = 2) {
  if (isnan(value) || isinf(value)) return "null";
  return String(value, decimals);
}

void updateFlow() {
  unsigned long now = millis();
  unsigned long elapsed = now - lastFlowSample;
  if (elapsed < 1000) return;
  uint32_t pulses;
  portENTER_CRITICAL(&flowMux);
  pulses = flowPulses;
  flowPulses = 0;
  portEXIT_CRITICAL(&flowMux);
  // L/s = pulses / pulses-per-litre / elapsed-seconds
  flowLps = (pulses / FLOW_PULSES_PER_LITER) / (elapsed / 1000.0f);
  lastFlowSample = now;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection timed out; will retry.");
  }
}

void sendTelemetry() {
  float particleDistance = readDistanceCm(PARTICLE_TRIG_PIN, PARTICLE_ECHO_PIN);
  delay(60);
  float waterDistance = readDistanceCm(WATER_TRIG_PIN, WATER_ECHO_PIN);
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  // This is the measured sensor-to-water surface distance, not water depth.
  // Convert to actual depth in the dashboard/backend only after installation calibration.
  int turbidity = analogRead(TURBIDITY_PIN);
  int methane = analogRead(MQ4_PIN);
  int carbonMonoxide = analogRead(MQ7_PIN);

  String body = "{";
  body += "\"node_id\":\"" + String(NODE_ID) + "\",";
  body += "\"water_level_cm\":" + jsonNumber(waterDistance) + ",";
  body += "\"particle_distance_cm\":" + jsonNumber(particleDistance) + ",";
  body += "\"pipe_distance_m\":null,";
  body += "\"flow_lps\":" + jsonNumber(flowLps, 4) + ",";
  body += "\"turbidity_raw\":" + String(turbidity) + ",";
  body += "\"methane_raw\":" + String(methane) + ",";
  body += "\"co_raw\":" + String(carbonMonoxide) + ",";
  body += "\"temperature_c\":" + jsonNumber(temperature) + ",";
  body += "\"humidity_pct\":" + jsonNumber(humidity) + ",";
  body += "\"battery_pct\":null";
  body += "}";

  WiFiClientSecure client;
  client.setInsecure(); // Prototype only; use certificate validation for production.
  HTTPClient http;
  if (!http.begin(client, SERVER_URL)) {
    Serial.println("HTTP begin failed");
    return;
  }
  http.setTimeout(15000);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  Serial.printf("POST status: %d\n", code);
  if (code > 0) Serial.println(http.getString());
  else Serial.println(http.errorToString(code));
  http.end();
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  pinMode(PARTICLE_TRIG_PIN, OUTPUT);
  pinMode(PARTICLE_ECHO_PIN, INPUT);
  pinMode(WATER_TRIG_PIN, OUTPUT);
  pinMode(WATER_ECHO_PIN, INPUT);
  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), onFlowPulse, RISING);
  dht.begin();
  lastFlowSample = millis();
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  updateFlow();
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    if (WiFi.status() == WL_CONNECTED) sendTelemetry();
  }
}

/*
SAFETY / CALIBRATION:
- ESP32 GPIO is 3.3V. Never connect either ultrasonic ECHO directly if it outputs 5V;
  use a correctly calculated resistor divider or a level shifter.
- MQ-4, MQ-7 and turbidity are raw ADC counts, NOT ppm or NTU.
- Keep every analog output at or below 3.3V at the ESP32 pin.
- ZJ-S201 default 450 pulses/L is an initial estimate; calibrate with a known volume.
- Ultrasonic values are distances. Water depth needs the installed sensor-to-bottom
  reference distance; do not label distance as depth until that offset is configured.
- setInsecure() is prototype-only TLS. Use certificate validation for production.
- Do not use this prototype as a certified gas or sewer safety instrument.
*/
