/**
 ******************************************************************************
 * @file           : sim800l.c
 * @brief          : Реализация протокола связи с SIM800L и HTTP POST диспетчера
 *                   Проект: StopControl — Мониторинг остановок городского транспорта
 ******************************************************************************
 */

#include "sim800l.h"
#include "config.h"
#include <string.h>
#include <stdio.h>

extern void UART_SendString(const char *str);
extern bool UART_WaitForResponse(const char *expected, uint32_t timeout_ms);
extern uint16_t UART_ReadResponse(char *buffer, uint16_t max_len, uint32_t timeout_ms);
extern void GPIO_WritePin(uint32_t port, uint16_t pin, bool state);
extern void Delay_Ms(uint32_t ms);

static char rx_buffer[512];
static char tx_payload[384];

/**
 * @brief Аппаратное включение модуля SIM800L через пин PWRKEY
 */
bool GSM_PowerOn(void) {
    /* PWRKEY активный низкий уровень на 1.2 секунды */
    GPIO_WritePin(1, GSM_PWR_KEY_PIN, true);
    Delay_Ms(100);
    GPIO_WritePin(1, GSM_PWR_KEY_PIN, false);
    Delay_Ms(1200);
    GPIO_WritePin(1, GSM_PWR_KEY_PIN, true);
    Delay_Ms(3000); /* Ожидание старта радиомодема */

    /* Проверка готовности AT-интерфейса */
    for (int i = 0; i < 5; i++) {
        UART_SendString("AT\r\n");
        if (UART_WaitForResponse("OK", 1000)) {
            UART_SendString("ATE0\r\n"); /* Отключаем эхо */
            UART_WaitForResponse("OK", 1000);
            return true;
        }
        Delay_Ms(500);
    }
    return false;
}

/**
 * @brief Проверка регистрации в сотовой сети
 */
bool GSM_InitNetwork(void) {
    /* Проверка SIM-карты */
    UART_SendString("AT+CPIN?\r\n");
    if (!UART_WaitForResponse("+CPIN: READY", 3000)) {
        return false;
    }

    /* Проверка регистрации в сети (Home или Roaming) */
    for (int retry = 0; retry < 15; retry++) {
        UART_SendString("AT+CREG?\r\n");
        uint16_t len = UART_ReadResponse(rx_buffer, sizeof(rx_buffer), 2000);
        if (strstr(rx_buffer, "+CREG: 0,1") != NULL || strstr(rx_buffer, "+CREG: 0,5") != NULL) {
            return true;
        }
        Delay_Ms(1000);
    }
    return false;
}

/**
 * @brief Установка GPRS соединения с точкой доступа оператора (APN)
 */
bool GSM_ConnectGPRS(const char *apn, const char *user, const char *pass) {
    char cmd[128];

    /* Закрыть старый контекст, если открыт */
    UART_SendString("AT+SAPBR=0,1\r\n");
    UART_WaitForResponse("OK", 2000);

    /* Тип соединения GPRS */
    UART_SendString("AT+SAPBR=3,1,\"Contype\",\"GPRS\"\r\n");
    if (!UART_WaitForResponse("OK", 3000)) return false;

    /* Задание APN */
    snprintf(cmd, sizeof(cmd), "AT+SAPBR=3,1,\"APN\",\"%s\"\r\n", apn);
    UART_SendString(cmd);
    if (!UART_WaitForResponse("OK", 3000)) return false;

    /* Открытие контекста bearer */
    UART_SendString("AT+SAPBR=1,1\r\n");
    if (!UART_WaitForResponse("OK", 10000)) {
        return false;
    }

    return true;
}

/**
 * @brief Чтение уровня сигнала RSSI в dBm
 */
int8_t GSM_GetSignalQuality(void) {
    UART_SendString("AT+CSQ\r\n");
    UART_ReadResponse(rx_buffer, sizeof(rx_buffer), 2000);

    int csq = 0;
    if (sscanf(rx_buffer, "\r\n+CSQ: %d,", &csq) == 1) {
        if (csq == 99) return -120; /* Нет сигнала */
        return -113 + (csq * 2);    /* Пересчёт в dBm */
    }
    return -90;
}

/**
 * @brief Преобразование перечисления события в строковый идентификатор сервера
 */
static const char* EventToString(TelemetryEvent_t event) {
    switch (event) {
        case EVENT_IMPACT:          return "impact";
        case EVENT_LIGHT_FAILURE:   return "light_failure";
        case EVENT_GLASS_BREAK:     return "glass_break";
        case EVENT_DISPLAY_ERROR:   return "display_error";
        case EVENT_PING:
        default:                    return "ping";
    }
}

/**
 * @brief Отправка JSON пакета на эндпоинт /api/telemetry веб-сервера StopControl
 */
bool GSM_SendTelemetry(TelemetryEvent_t event, const char *details, const SensorData_t *sensors) {
    char cmd[160];
    const char *ev_str = EventToString(event);

    /* Формирование JSON полезной нагрузки */
    snprintf(tx_payload, sizeof(tx_payload),
        "{\"apiKey\":\"%s\",\"deviceId\":\"%s\",\"stopId\":\"%s\",\"event\":\"%s\","
        "\"details\":\"%s\",\"gForce\":%.2f,\"lux\":%u,\"battery\":%.2f}",
        DEVICE_API_KEY,
        DEVICE_ID,
        STOP_ID,
        ev_str,
        details ? details : "Аварийный сигнал STM32",
        sensors ? sensors->total_g : 1.0f,
        sensors ? sensors->light_lux : 0,
        sensors ? sensors->battery_voltage : 4.0f
    );

    /* Инициализация HTTP стека */
    UART_SendString("AT+HTTPTERM\r\n");
    Delay_Ms(200);

    UART_SendString("AT+HTTPINIT\r\n");
    if (!UART_WaitForResponse("OK", 4000)) return false;

    /* Настройка Bearer профиля */
    UART_SendString("AT+HTTPPARA=\"CID\",1\r\n");
    UART_WaitForResponse("OK", 2000);

    /* Установка целевого URL */
    snprintf(cmd, sizeof(cmd), "AT+HTTPPARA=\"URL\",\"https://%s%s\"\r\n", SERVER_HOST, TELEMETRY_ENDPOINT);
    UART_SendString(cmd);
    if (!UART_WaitForResponse("OK", 3000)) {
        UART_SendString("AT+HTTPTERM\r\n");
        return false;
    }

    /* Заголовки Content-Type и X-Device-Key */
    UART_SendString("AT+HTTPPARA=\"CONTENT\",\"application/json\"\r\n");
    UART_WaitForResponse("OK", 2000);

    /* Передача длины данных */
    uint16_t data_len = (uint16_t)strlen(tx_payload);
    snprintf(cmd, sizeof(cmd), "AT+HTTPDATA=%u,10000\r\n", data_len);
    UART_SendString(cmd);
    if (!UART_WaitForResponse("DOWNLOAD", 5000)) {
        UART_SendString("AT+HTTPTERM\r\n");
        return false;
    }

    /* Отправка тела запроса */
    UART_SendString(tx_payload);
    if (!UART_WaitForResponse("OK", 5000)) {
        UART_SendString("AT+HTTPTERM\r\n");
        return false;
    }

    /* Запуск метода POST (1 = POST) */
    UART_SendString("AT+HTTPACTION=1\r\n");

    /* Ожидание ответа сервера (+HTTPACTION: 1,200,<len>) */
    if (UART_WaitForResponse("+HTTPACTION: 1,200", GSM_HTTP_TIMEOUT_MS)) {
        /* Чтение ответа сервера */
        UART_SendString("AT+HTTPREAD\r\n");
        UART_ReadResponse(rx_buffer, sizeof(rx_buffer), 3000);

        UART_SendString("AT+HTTPTERM\r\n");
        return true;
    }

    /* В случае ошибки закрываем HTTP сессию */
    UART_SendString("AT+HTTPTERM\r\n");
    return false;
}
