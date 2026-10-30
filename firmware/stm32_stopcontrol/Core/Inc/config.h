/**
 ******************************************************************************
 * @file           : config.h
 * @brief          : Конфигурационные параметры телеметрического модуля STM32
 *                   Проект: StopControl — Мониторинг остановок городского транспорта
 ******************************************************************************
 */

#ifndef __CONFIG_H__
#define __CONFIG_H__

/* Идентификация аппаратного контроллера */
#define DEVICE_ID               "dev-stm32-01"
#define DEVICE_MODEL            "STM32F401RE-StopGuard"
#define FIRMWARE_VERSION        "v1.4.2-rel"
#define HARDWARE_REVISION       "REV_2.1"

/* Учётные данные и сервер мониторинга */
#define SERVER_HOST             "stopcontrol.vercel.app"
#define SERVER_PORT             443
#define TELEMETRY_ENDPOINT      "/api/telemetry"
#define DEVICE_API_KEY          "dkey_vn_sennaya_78a1c9e2"
#define STOP_ID                 "stop-vn-1"

/* Настройки сотовой сети (GSM / GPRS SIM800L) */
#define GSM_APN                 "internet.mts.ru"
#define GSM_APN_USER            "mts"
#define GSM_APN_PASSWORD        "mts"
#define GSM_UART_BAUDRATE       9600
#define GSM_CMD_TIMEOUT_MS      8000
#define GSM_HTTP_TIMEOUT_MS     15000

/* Пороговые значения сенсоров (Аварийные критерии) */
#define SHOCK_THRESHOLD_G       4.0f    /* Порог удара по опоре (g-force) для детекции ДТП/вандализма */
#define LIGHT_DARK_THRESHOLD_LUX 15      /* Порог темного времени суток (лк) */
#define LIGHT_MIN_NIGHT_LUX     1       /* Если включено освещение, но датчик фиксирует 0..1 лк -> обрыв цепи */
#define BATTERY_MIN_VOLTAGE     3.4f    /* Минимальное напряжение резервного аккумулятора (В) */

/* Периодичность отправки штатной телеметрии */
#define HEARTBEAT_INTERVAL_SEC  1800    /* 30 минут между регулярными пакетами Heartbeat (норма) */
#define RETRY_ALARM_INTERVAL_SEC 60     /* Интервал повтора при ошибке доставки тревоги */

#endif /* __CONFIG_H__ */
