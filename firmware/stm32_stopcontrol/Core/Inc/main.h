/**
 ******************************************************************************
 * @file           : main.h
 * @brief          : Заголовочный файл главного модуля микроконтроллера STM32
 *                   Проект: StopControl — Мониторинг остановок городского транспорта
 ******************************************************************************
 */

#ifndef __MAIN_H__
#define __MAIN_H__

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <stdio.h>
#include <math.h>

#include "config.h"

/* Статусы аппаратного контроллера */
typedef enum {
    SYS_STATE_INIT = 0,
    SYS_STATE_STANDBY,
    SYS_STATE_SENSING,
    SYS_STATE_ALARM,
    SYS_STATE_TX_TELEMETRY,
    SYS_STATE_ERROR
} SystemState_t;

/* Типы событий для телеметрического сервера */
typedef enum {
    EVENT_PING = 0,
    EVENT_IMPACT,
    EVENT_LIGHT_FAILURE,
    EVENT_GLASS_BREAK,
    EVENT_DISPLAY_ERROR
} TelemetryEvent_t;

/* Структура показаний датчиков */
typedef struct {
    float accel_x;          /* Ускорение X (g) */
    float accel_y;          /* Ускорение Y (g) */
    float accel_z;          /* Ускорение Z (g) */
    float total_g;          /* Результирующий вектор перегрузки (g) */
    uint16_t light_lux;     /* Освещенность внутри павильона (лк) */
    bool is_light_powered;  /* Напряжение на линии городского освещения (220V/12V) */
    bool glass_sensor_tripped; /* Срабатывание акустического сенсора остекления */
    bool tamper_open;       /* Вскрытие сервисного шкафа автоматики */
    float battery_voltage;  /* Напряжение буферного аккумулятора LiFePO4 */
    int8_t gsm_rssi;        /* Уровень сигнала сотовой сети (dBm) */
} SensorData_t;

/* Назначение выводов GPIO (STM32F401RE / STM32F103) */
#define LED_SYS_PIN             (1 << 5)  /* PA5 - Индикатор работы микроконтроллера (Heartbeat) */
#define LED_ALARM_PIN           (1 << 6)  /* PA6 - Индикатор тревоги (красный) */
#define LED_GSM_PIN             (1 << 7)  /* PA7 - Индикатор активности GSM передачи */

#define GSM_PWR_KEY_PIN         (1 << 0)  /* PB0 - Управление питанием модуля SIM800L (PWRKEY) */
#define GSM_RESET_PIN           (1 << 1)  /* PB1 - Аппаратный сброс модема (RST) */
#define MPU_INT_PIN             (1 << 4)  /* PC4 - Прерывание EXTI4 от акселерометра MPU6050 */
#define GLASS_INT_PIN           (1 << 5)  /* PC5 - Прерывание EXTI5 от акустического датчика стекла */
#define TAMPER_INT_PIN          (1 << 13) /* PC13 - Концевой выключатель шкафа автоматики */

/* Прототипы функций */
void SystemClock_Config(void);
void GPIO_Init(void);
void IWDG_Init(void);
void IWDG_Refresh(void);
void Error_Handler(const char *msg);

#ifdef __cplusplus
}
#endif

#endif /* __MAIN_H__ */
