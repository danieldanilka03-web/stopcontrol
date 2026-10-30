/**
 ******************************************************************************
 * @file           : sim800l.h
 * @brief          : Драйвер модема SIM800L GSM/GPRS (UART AT-команды)
 *                   Проект: StopControl — Мониторинг остановок городского транспорта
 ******************************************************************************
 */

#ifndef __SIM800L_H__
#define __SIM800L_H__

#include <stdint.h>
#include <stdbool.h>
#include "main.h"

/* Статусы GSM-модема */
typedef enum {
    GSM_STATUS_POWER_OFF = 0,
    GSM_STATUS_READY,
    GSM_STATUS_NET_REGISTERED,
    GSM_STATUS_GPRS_CONNECTED,
    GSM_STATUS_ERROR
} GSM_Status_t;

/* Функции драйвера SIM800L */
bool GSM_PowerOn(void);
void GSM_PowerOff(void);
bool GSM_InitNetwork(void);
bool GSM_ConnectGPRS(const char *apn, const char *user, const char *pass);
bool GSM_DisconnectGPRS(void);
int8_t GSM_GetSignalQuality(void);

/* Отправка пакета телеметрии на веб-сервер StopControl */
bool GSM_SendTelemetry(TelemetryEvent_t event, const char *details, const SensorData_t *sensors);

#endif /* __SIM800L_H__ */
