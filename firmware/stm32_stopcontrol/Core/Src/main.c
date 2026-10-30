/**
 ******************************************************************************
 * @file           : main.c
 * @brief          : Главный исполняемый модуль прошивки STM32F401 / STM32F103
 *                   Проект: StopControl — Мониторинг остановок городского транспорта
 *                   Разработано для дипломного проекта / защиты системы
 ******************************************************************************
 */

#include "main.h"
#include "config.h"
#include "mpu6050.h"
#include "sensors.h"
#include "sim800l.h"

/* Глобальное состояние системы */
static volatile SystemState_t current_state = SYS_STATE_INIT;
static volatile bool flag_alarm_impact = false;
static volatile bool flag_alarm_glass = false;
static volatile bool flag_alarm_tamper = false;

static SensorData_t current_sensors = {0};
static uint32_t last_heartbeat_tick = 0;
static uint32_t system_uptime_sec = 0;

/* Вспомогательные функции системного уровня (HAL / CMSIS заглушки) */
void SystemClock_Config(void) {
    /* Настройка PLL: Тактирование ядра 84 МГц от кварцевого резонатора HSE 8 МГц */
}

void GPIO_Init(void) {
    /* Настройка пинов индикации PA5 (SYS), PA6 (ALARM), PA7 (GSM) на выход Push-Pull */
    /* Настройка пинов управления модемом PB0 (PWRKEY), PB1 (RST) на выход */
    /* Настройка пинов прерываний PC4 (MPU), PC5 (GLASS), PC13 (TAMPER) на вход с подтяжкой */
}

void IWDG_Init(void) {
    /* Аппаратный сторожевой таймер на 16 секунд для защиты от зависаний в полевых условиях */
}

void IWDG_Refresh(void) {
    /* Сброс сторожевого таймера */
}

void Delay_Ms(uint32_t ms) {
    /* Задержка на основе SysTick таймера */
    volatile uint32_t count = ms * 8000;
    while (count--) { __asm("nop"); }
}

void GPIO_WritePin(uint32_t port, uint16_t pin, bool state) {
    /* Запись логического уровня в регистр BSRR */
    (void)port; (void)pin; (void)state;
}

bool GPIO_ReadPin(uint32_t port, uint16_t pin) {
    (void)port; (void)pin;
    return false;
}

uint16_t ADC_ReadChannel(uint8_t channel) {
    /* Выборка АЦП (12 бит, 0..4095) */
    if (channel == ADC_CH_LIGHT) return 320; /* Типичное дневное освещение */
    if (channel == ADC_CH_BATTERY) return 2540; /* 4.08V на батарее */
    return 0;
}

bool I2C_WriteReg(uint8_t dev_addr, uint8_t reg, uint8_t data) {
    (void)dev_addr; (void)reg; (void)data;
    return true;
}

bool I2C_ReadRegs(uint8_t dev_addr, uint8_t reg, uint8_t *buf, uint16_t len) {
    (void)dev_addr; (void)reg;
    if (reg == MPU6050_REG_WHO_AM_I && buf && len >= 1) {
        buf[0] = 0x68; /* Корректный ID MPU6050 */
        return true;
    }
    if (reg == MPU6050_REG_ACCEL_XOUT_H && buf && len >= 6) {
        /* Имитация нормального гравитационного вектора 1g по оси Z */
        buf[0] = 0; buf[1] = 0;
        buf[2] = 0; buf[3] = 0;
        buf[4] = (uint8_t)(4096 >> 8); buf[5] = (uint8_t)(4096 & 0xFF);
        return true;
    }
    return true;
}

void UART_SendString(const char *str) {
    (void)str;
}

bool UART_WaitForResponse(const char *expected, uint32_t timeout_ms) {
    (void)expected; (void)timeout_ms;
    return true;
}

uint16_t UART_ReadResponse(char *buffer, uint16_t max_len, uint32_t timeout_ms) {
    (void)timeout_ms;
    if (buffer && max_len > 16) {
        strncpy(buffer, "\r\n+CREG: 0,1\r\nOK\r\n", max_len);
        return (uint16_t)strlen(buffer);
    }
    return 0;
}

/* ================= Обработчики аппаратных прерываний (EXTI) ================= */

/**
 * @brief Прерывание EXTI4 от акселерометра MPU6050 (Пин PC4)
 * Вызывается аппаратно, когда ускорение превышает порог Wake-On-Motion
 */
void EXTI4_IRQHandler(void) {
    flag_alarm_impact = true;
    current_state = SYS_STATE_ALARM;
}

/**
 * @brief Прерывание EXTI9_5 от акустического датчика разбития стекла (PC5)
 */
void EXTI9_5_IRQHandler(void) {
    flag_alarm_glass = true;
    current_state = SYS_STATE_ALARM;
}

/**
 * @brief Прерывание EXTI15_10 от датчика вскрытия шкафа (PC13)
 */
void EXTI15_10_IRQHandler(void) {
    flag_alarm_tamper = true;
    current_state = SYS_STATE_ALARM;
}

/* ================= Главный цикл программы ================= */

int main(void) {
    /* 1. Инициализация системных периферийных блоков */
    SystemClock_Config();
    GPIO_Init();
    IWDG_Init();

    /* Индикация старта контроллера */
    GPIO_WritePin(0, LED_SYS_PIN, true);

    /* 2. Инициализация I2C сенсора удара MPU6050 */
    if (MPU6050_Init()) {
        /* Настройка аппаратного прерывания при ударе свыше 4.0g */
        uint8_t threshold_lsb = (uint8_t)(SHOCK_THRESHOLD_G * 1000.0f / 32.0f);
        MPU6050_ConfigureWakeOnMotion(threshold_lsb);
    }

    /* 3. Инициализация аналоговых датчиков */
    Sensors_Init();

    /* 4. Запуск модема SIM800L и подключение к сотовой сети */
    GPIO_WritePin(0, LED_GSM_PIN, true);
    if (GSM_PowerOn() && GSM_InitNetwork()) {
        GSM_ConnectGPRS(GSM_APN, GSM_APN_USER, GSM_APN_PASSWORD);
        /* Отправка стартового приветственного пакета на веб-сервер */
        Sensors_ReadAll(&current_sensors);
        GSM_SendTelemetry(EVENT_PING, "Контроллер STM32 успешно запущен и вышел на связь", &current_sensors);
    }
    GPIO_WritePin(0, LED_GSM_PIN, false);

    current_state = SYS_STATE_STANDBY;

    /* 5. Бесконечный суперцикл обработки событий */
    while (1) {
        IWDG_Refresh();

        /* Мигание светодиодом статуса (Heartbeat раз в 2 секунды) */
        if ((system_uptime_sec % 2) == 0) {
            GPIO_WritePin(0, LED_SYS_PIN, true);
        } else {
            GPIO_WritePin(0, LED_SYS_PIN, false);
        }

        switch (current_state) {

            case SYS_STATE_STANDBY:
                /* Опрос аналоговых сенсоров каждые 5 секунд */
                Sensors_ReadAll(&current_sensors);

                /* Проверка: не произошло ли аварии с освещением ночью */
                if (Sensors_CheckNightLightingFailure(&current_sensors)) {
                    current_state = SYS_STATE_ALARM;
                    break;
                }

                /* Проверка превышения порога удара при циклическом опросе */
                if (current_sensors.total_g > SHOCK_THRESHOLD_G) {
                    flag_alarm_impact = true;
                    current_state = SYS_STATE_ALARM;
                    break;
                }

                /* Проверка наступления времени отправки регулярного Heartbeat */
                if ((system_uptime_sec - last_heartbeat_tick) >= HEARTBEAT_INTERVAL_SEC) {
                    current_state = SYS_STATE_TX_TELEMETRY;
                }
                break;

            case SYS_STATE_ALARM:
                /* Включение красного светодиода ТРЕВОГА */
                GPIO_WritePin(0, LED_ALARM_PIN, true);
                GPIO_WritePin(0, LED_GSM_PIN, true);

                /* Формирование и немедленная отправка аварийного пакета */
                if (flag_alarm_impact) {
                    flag_alarm_impact = false;
                    char desc[128];
                    snprintf(desc, sizeof(desc), "Кинетический удар %.2fg по металлоконструкции павильона", current_sensors.total_g);
                    GSM_SendTelemetry(EVENT_IMPACT, desc, &current_sensors);
                } else if (flag_alarm_glass) {
                    flag_alarm_glass = false;
                    GSM_SendTelemetry(EVENT_GLASS_BREAK, "Сработал акустический сенсор разрушения остекления", &current_sensors);
                } else if (Sensors_CheckNightLightingFailure(&current_sensors)) {
                    GSM_SendTelemetry(EVENT_LIGHT_FAILURE, "Авария освещения: линия 220В активна, свет в павильоне не горит (0 лк)", &current_sensors);
                } else if (flag_alarm_tamper) {
                    flag_alarm_tamper = false;
                    GSM_SendTelemetry(EVENT_IMPACT, "Несанкционированное вскрытие шкафа автоматики павильона", &current_sensors);
                }

                GPIO_WritePin(0, LED_GSM_PIN, false);
                Delay_Ms(3000);
                GPIO_WritePin(0, LED_ALARM_PIN, false);
                current_state = SYS_STATE_STANDBY;
                break;

            case SYS_STATE_TX_TELEMETRY:
                /* Отправка штатной телеметрии на сервер */
                GPIO_WritePin(0, LED_GSM_PIN, true);
                Sensors_ReadAll(&current_sensors);
                current_sensors.gsm_rssi = GSM_GetSignalQuality();

                if (GSM_SendTelemetry(EVENT_PING, "Штатная телеметрия: температура, АКБ, связь", &current_sensors)) {
                    last_heartbeat_tick = system_uptime_sec;
                }

                GPIO_WritePin(0, LED_GSM_PIN, false);
                current_state = SYS_STATE_STANDBY;
                break;

            default:
                current_state = SYS_STATE_STANDBY;
                break;
        }

        Delay_Ms(1000);
        system_uptime_sec++;
    }

    return 0;
}
