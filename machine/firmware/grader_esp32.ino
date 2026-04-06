// =============================================
// Blueberry Grader - ESP32 Motor Controller
// ESP32-WROOM-32 38-pin
// =============================================
// WIRING:
//   L298N IN1  -> GPIO 25 (Motor A direction)
//   L298N IN2  -> GPIO 26 (Motor A direction)
//   L298N ENA  -> GPIO 27 (Motor A speed PWM)
//   L298N IN3  -> GPIO 14 (Motor B direction)
//   L298N IN4  -> GPIO 12 (Motor B direction)
//   L298N ENB  -> GPIO 13 (Motor B speed PWM)
//   Start btn  -> GPIO 34 (INPUT, other leg to GND)
//   Status LED -> GPIO 2  (onboard LED)
//   L298N 12V  -> 12V supply
//   L298N GND  -> common GND with ESP32
//   L298N 5V out -> ESP32 VIN (powers ESP32 from same supply)
// =============================================

// --- Pin definitions ---
#define MOTOR_A_IN1   25
#define MOTOR_A_IN2   26
#define MOTOR_A_ENA   27
#define MOTOR_B_IN3   14
#define MOTOR_B_IN4   12
#define MOTOR_B_ENB   13
#define START_BUTTON  34
#define STATUS_LED    2

// --- PWM config ---
#define PWM_FREQ      5000
#define PWM_RES       8        // 8 bit = 0-255
#define PWM_CHAN_A    0
#define PWM_CHAN_B    1

// --- Timing ---
#define SPIN_TIME     6000     // ms berries spin
#define RAMP_TIME     500      // ms to ramp up speed (gentle on berries)
#define MOTOR_SPEED   180      // 0-255, tune this for your motor/berry size

// --- State ---
bool running = false;

// =============================================
void setup() {
  Serial.begin(115200);

  // Motor pins
  pinMode(MOTOR_A_IN1, OUTPUT);
  pinMode(MOTOR_A_IN2, OUTPUT);
  pinMode(MOTOR_B_IN3, OUTPUT);
  pinMode(MOTOR_B_IN4, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  pinMode(START_BUTTON, INPUT_PULLUP);

  // PWM channels
  ledcSetup(PWM_CHAN_A, PWM_FREQ, PWM_RES);
  ledcSetup(PWM_CHAN_B, PWM_FREQ, PWM_RES);
  ledcAttachPin(MOTOR_A_ENA, PWM_CHAN_A);
  ledcAttachPin(MOTOR_B_ENB, PWM_CHAN_B);

  motorsStop();
  digitalWrite(STATUS_LED, HIGH); // ready
  Serial.println("READY");
}

// =============================================
void loop() {
  // Start from physical button
  if (digitalRead(START_BUTTON) == LOW && !running) {
    delay(50); // debounce
    if (digitalRead(START_BUTTON) == LOW) {
      runCycle();
    }
  }

  // Start from serial command (laptop/pi sends "START")
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "START" && !running) {
      runCycle();
    }
    if (cmd == "SPEED") {
      // Future: receive speed value
    }
  }
}

// =============================================
void runCycle() {
  running = true;
  digitalWrite(STATUS_LED, LOW);

  // Tell laptop to begin capturing
  Serial.println("CAPTURING");

  // Ramp up gently so berries don't jump out
  motorsForward();
  for (int speed = 0; speed <= MOTOR_SPEED; speed += 5) {
    ledcWrite(PWM_CHAN_A, speed);
    ledcWrite(PWM_CHAN_B, speed);
    delay(RAMP_TIME / (MOTOR_SPEED / 5));
  }

  // Spin for full duration
  delay(SPIN_TIME);

  // Ramp down gently
  for (int speed = MOTOR_SPEED; speed >= 0; speed -= 5) {
    ledcWrite(PWM_CHAN_A, speed);
    ledcWrite(PWM_CHAN_B, speed);
    delay(RAMP_TIME / (MOTOR_SPEED / 5));
  }

  motorsStop();

  // Tell laptop capture window is closed
  Serial.println("DONE");

  digitalWrite(STATUS_LED, HIGH);
  running = false;

  delay(1000); // cooldown before ready again
}

// =============================================
void motorsForward() {
  // Motor A spins clockwise
  digitalWrite(MOTOR_A_IN1, HIGH);
  digitalWrite(MOTOR_A_IN2, LOW);
  // Motor B spins counter-clockwise (opposite = berry spins in place)
  digitalWrite(MOTOR_B_IN3, LOW);
  digitalWrite(MOTOR_B_IN4, HIGH);
}

void motorsStop() {
  digitalWrite(MOTOR_A_IN1, LOW);
  digitalWrite(MOTOR_A_IN2, LOW);
  digitalWrite(MOTOR_B_IN3, LOW);
  digitalWrite(MOTOR_B_IN4, LOW);
  ledcWrite(PWM_CHAN_A, 0);
  ledcWrite(PWM_CHAN_B, 0);
}
