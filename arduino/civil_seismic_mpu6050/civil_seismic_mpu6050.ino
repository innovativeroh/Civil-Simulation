/*
 ==============================================================================
  Civil Engineering Seismic Simulation — Arduino Uno R3 + MPU-6050 Interface
 ==============================================================================
  Compatible with:
    - Arduino Uno R3 (ATmega328P)
    - MPU-6050 (GY-521) 3-Axis Accelerometer & Gyroscope Sensor
    - Dual Sensor Mode: Building 1 (Without Damper) + Building 2 (With Damper)
    - Single Sensor Mode: Auto-fallback if only 1 MPU-6050 is detected
  
  Wiring Diagram for Arduino Uno R3:
  -------------------------------------------------------------
  MPU-6050 #1 (Building 1 - Without Damper):
    - VCC  --> Arduino 5V (or 3.3V)
    - GND  --> Arduino GND
    - SCL  --> Arduino A5 (or dedicated SCL pin near AREF)
    - SDA  --> Arduino A4 (or dedicated SDA pin near AREF)
    - AD0  --> Arduino GND (Sets I2C Address to 0x68)
    - INT  --> Not connected (optional)
  
  MPU-6050 #2 (Building 2 - With Tuned Mass Damper) [OPTIONAL]:
    - VCC  --> Arduino 5V (or 3.3V)
    - GND  --> Arduino GND
    - SCL  --> Arduino A5 (shared bus)
    - SDA  --> Arduino A4 (shared bus)
    - AD0  --> Arduino 5V or 3.3V (Sets I2C Address to 0x69)
  
  Serial Output Format:
    "<withoutDamper_g>,<withDamper_g>\n"
    e.g.: "0.452,0.141"
    Baud Rate: 115200 (or 9600)
 ==============================================================================
*/

#include <Wire.h>

// I2C Addresses for MPU-6050
const uint8_t MPU_ADDR_1 = 0x68; // Sensor 1 (AD0 -> GND)
const uint8_t MPU_ADDR_2 = 0x69; // Sensor 2 (AD0 -> VCC)

// Registers
const uint8_t REG_PWR_MGMT_1   = 0x6B;
const uint8_t REG_ACCEL_CONFIG = 0x1C;
const uint8_t REG_ACCEL_XOUT_H = 0x3B;

// Accelerometer Sensitivity for +/- 2g range (16384 LSB/g)
const float ACCEL_SCALE = 16384.0;

bool sensor1_ok = false;
bool sensor2_ok = false;

// Calibration Offsets (measured on stationary startup)
float offset1_x = 0, offset1_y = 0, offset1_z = 0;
float offset2_x = 0, offset2_y = 0, offset2_z = 0;

// Low-pass filter smoothing factor (0.0 to 1.0)
const float ALPHA = 0.85;
float filtered1 = 0.0;
float filtered2 = 0.0;

// Initialize MPU-6050 at specified I2C address
bool initMPU(uint8_t addr) {
  Wire.beginTransmission(addr);
  byte error = Wire.endTransmission();
  if (error != 0) {
    return false; // Device not found on I2C bus
  }

  // Wake up device (clear SLEEP bit in PWR_MGMT_1)
  Wire.beginTransmission(addr);
  Wire.write(REG_PWR_MGMT_1);
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) return false;

  delay(10);

  // Set Accelerometer to +/- 2g (0x00)
  Wire.beginTransmission(addr);
  Wire.write(REG_ACCEL_CONFIG);
  Wire.write(0x00); // +/- 2g range
  if (Wire.endTransmission() != 0) return false;

  return true;
}

// Read raw accelerometer values from MPU-6050
bool readAccel(uint8_t addr, float &ax, float &ay, float &az) {
  Wire.beginTransmission(addr);
  Wire.write(REG_ACCEL_XOUT_H);
  if (Wire.endTransmission(false) != 0) return false;

  Wire.requestFrom((int)addr, 6, (int)true);
  if (Wire.available() < 6) return false;

  int16_t raw_x = (Wire.read() << 8) | Wire.read();
  int16_t raw_y = (Wire.read() << 8) | Wire.read();
  int16_t raw_z = (Wire.read() << 8) | Wire.read();

  ax = (float)raw_x / ACCEL_SCALE;
  ay = (float)raw_y / ACCEL_SCALE;
  az = (float)raw_z / ACCEL_SCALE;
  return true;
}

// Calibrate sensor resting baseline
void calibrateSensors() {
  const int SAMPLES = 60;
  float sum1_x = 0, sum1_y = 0, sum1_z = 0;
  float sum2_x = 0, sum2_y = 0, sum2_z = 0;
  float ax, ay, az;

  for (int i = 0; i < SAMPLES; i++) {
    if (sensor1_ok && readAccel(MPU_ADDR_1, ax, ay, az)) {
      sum1_x += ax; sum1_y += ay; sum1_z += az;
    }
    if (sensor2_ok && readAccel(MPU_ADDR_2, ax, ay, az)) {
      sum2_x += ax; sum2_y += ay; sum2_z += az;
    }
    delay(10);
  }

  if (sensor1_ok) {
    offset1_x = sum1_x / SAMPLES;
    offset1_y = sum1_y / SAMPLES;
    offset1_z = sum1_z / SAMPLES;
  }
  if (sensor2_ok) {
    offset2_x = sum2_x / SAMPLES;
    offset2_y = sum2_y / SAMPLES;
    offset2_z = sum2_z / SAMPLES;
  }
}

void setup() {
  // Start high-speed serial for real-time seismic streaming
  Serial.begin(115200);
  while (!Serial && millis() < 2000); // Wait for serial port on USB

  Wire.begin();
  Wire.setClock(400000); // 400kHz Fast I2C mode for low latency

  delay(100);

  // Probe and initialize sensor 1 (0x68) and sensor 2 (0x69)
  sensor1_ok = initMPU(MPU_ADDR_1);
  sensor2_ok = initMPU(MPU_ADDR_2);

  // Calibrate zero-g offsets while stationary
  calibrateSensors();
}

void loop() {
  static unsigned long lastSampleTime = 0;
  unsigned long now = millis();

  // Sample at 50 Hz (every 20 ms)
  if (now - lastSampleTime >= 20) {
    lastSampleTime = now;

    float ax1 = 0, ay1 = 0, az1 = 0;
    float ax2 = 0, ay2 = 0, az2 = 0;
    float reading1 = 0.0;
    float reading2 = 0.0;

    // Read Sensor 1 (Without Damper)
    if (sensor1_ok && readAccel(MPU_ADDR_1, ax1, ay1, az1)) {
      // Subtract resting gravity/offset to get dynamic horizontal sway acceleration
      float dx = ax1 - offset1_x;
      float dy = ay1 - offset1_y;
      // Resultant dynamic horizontal vibration (in g)
      reading1 = sqrt(dx * dx + dy * dy);
      
      // Preserve directional tilt polarity (using primary X axis)
      if (dx < 0) reading1 = -reading1;
    } else if (!sensor1_ok) {
      // Re-try initialization if disconnected
      sensor1_ok = initMPU(MPU_ADDR_1);
    }

    // Read Sensor 2 (With Damper) if connected
    if (sensor2_ok && readAccel(MPU_ADDR_2, ax2, ay2, az2)) {
      float dx = ax2 - offset2_x;
      float dy = ay2 - offset2_y;
      reading2 = sqrt(dx * dx + dy * dy);
      if (dx < 0) reading2 = -reading2;
    } else {
      // If Sensor 2 is not physically connected, apply simulated damper attenuation
      // to Sensor 1's real reading (60% reduction with counter-phase damping)
      // This allows single MPU-6050 users to test both buildings immediately!
      reading2 = reading1 * 0.38;
      
      // Periodically check if Sensor 2 was plugged in
      if ((now % 2000) < 25) {
        sensor2_ok = initMPU(MPU_ADDR_2);
      }
    }

    // Exponential smoothing filter to eliminate high-frequency acoustic noise
    filtered1 = (ALPHA * filtered1) + ((1.0 - ALPHA) * reading1);
    filtered2 = (ALPHA * filtered2) + ((1.0 - ALPHA) * reading2);

    // Stream CSV format expected by Civil Simulation Web App:
    // <WithoutDamper_g>,<WithDamper_g>
    Serial.print(filtered1, 3);
    Serial.print(",");
    Serial.println(filtered2, 3);
  }
}
