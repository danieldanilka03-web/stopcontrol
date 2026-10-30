/**
 ******************************************************************************
 * @file           : sensors.h
 * @brief          : Модуль опроса аналоговых и дискретных сенсоров павильона
 *                   Проект: StopControl — Мониторинг остановок городского транспорта
 ******************************************************************************
 */

#ifndef __SENSORS_H__
#define __SENSORS_H__

#include <stdint.h>
#include <stdbool.h>
#include "main.h"

/* Каналы АЦП STM32 */
#define ADC_CH_LIGHT            0   /* PA0 - Фоторезистор GL5528 (делитель 10кОм) */
#define ADC_CH_BATTERY          1   /* PA1 - Делитель напряжения батареи LiFePO4 */

/* Цифровые входы */
#define PIN_GLASS_SENSOR        (1 << 5)  /* PC5 - Выход акустического датчика */
#define PIN_TAMPER_SWITCH       (1 << 13) /* PC13 - Концевик двери шкафа */
#define PIN_LIGHT_LINE_SENSE    (1 << 1)  /* PA1 - Оптопара контроля сети 220В */

void Sensors_Init(void);
void Sensors_ReadAll(SensorData_t *data);
uint16_t Sensors_ReadLightLux(void);
float Sensors_ReadBatteryVoltage(void);
bool Sensors_CheckNightLightingFailure(const SensorData_t *data);

#endif /* __SENSORS_H__ */
