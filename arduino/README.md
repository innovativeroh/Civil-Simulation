# Arduino Uno R3 + MPU-6050 Hardware Connection Guide

This guide explains how to connect and configure the **MPU-6050 3-Axis Accelerometer and Gyroscope sensor** with the **Arduino Uno R3** for the Civil Engineering Seismic & Tuned Mass Damper (TMD) Simulation.

---

## 1. Hardware Pinout & Wiring

The MPU-6050 communicates with the Arduino Uno R3 over the **I2C protocol** (two wires: SDA and SCL).

### Single Sensor Setup (Standard)
*Best for testing overall shake table motion or a single building model.*

| MPU-6050 Pin | Arduino Uno R3 Pin | Function / Description |
| :--- | :--- | :--- |
| **VCC** | **5V** (or **3.3V**) | Power supply (GY-521 has an onboard 3.3V LDO regulator) |
| **GND** | **GND** | Ground |
| **SCL** | **A5** (or dedicated SCL) | I2C Serial Clock |
| **SDA** | **A4** (or dedicated SDA) | I2C Serial Data |
| **AD0** | **GND** | Sets I2C Address to `0x68` (Primary address) |
| **INT** | *Leave disconnected* | Hardware interrupt (not required) |

---

### Dual Sensor Setup (Recommended for Full Civil Comparison)
*Place Sensor 1 on Building 1 (Without Damper) and Sensor 2 on Building 2 (With Damper).*

Both sensors share the same I2C bus (`A4` and `A5`), but have distinct I2C addresses controlled by the **AD0** pin:

#### Sensor 1 — Building 1 (Without Damper): Address `0x68`
- **VCC** ➔ Arduino **5V**
- **GND** ➔ Arduino **GND**
- **SDA** ➔ Arduino **A4**
- **SCL** ➔ Arduino **A5**
- **AD0** ➔ Arduino **GND** (selects address `0x68`)

#### Sensor 2 — Building 2 (With Tuned Mass Damper): Address `0x69`
- **VCC** ➔ Arduino **5V**
- **GND** ➔ Arduino **GND**
- **SDA** ➔ Arduino **A4** (shared line)
- **SCL** ➔ Arduino **A5** (shared line)
- **AD0** ➔ Arduino **5V** or **3.3V** (selects address `0x69`)

---

## 2. Arduino Firmware Installation

1. Open the [Arduino IDE](https://www.arduino.cc/en/software).
2. Connect your **Arduino Uno R3** via USB to your computer.
3. Open `arduino/civil_seismic_mpu6050/civil_seismic_mpu6050.ino`.
4. Go to **Tools > Board** and select **Arduino Uno**.
5. Go to **Tools > Port** and select your Arduino's serial port (e.g. `/dev/cu.usbmodem...` on macOS or `COMx` on Windows).
6. Click **Upload** (Arrow icon).
7. Ensure the Serial Monitor in Arduino IDE is **closed** before connecting in the web app (only one program can access the USB serial port at a time).

---

## 3. Web App Compatibility Features

The web app is equipped with an adaptive MPU-6050 telemetry engine:
- **Baud Rate Support**: Supports both **115200** (recommended high-speed) and **9600** baud rates.
- **Adaptive Data Parser**:
  - Automatically parses standard CSV: `withoutDamper, withDamper`
  - Accepts single-sensor feeds and handles 3-axis vectors
  - Auto-normalizes raw 16-bit ADC values (±16384 LSB/g) to physical G-force units
- **Zero-Tare Calibration**: One-click zeroing button directly in the web UI to cancel resting gravity offsets.
- **Seismic Telemetry Meters**: Displays Peak Ground Acceleration (PGA in g), sway deflection angles (°), and live structural stress %.
