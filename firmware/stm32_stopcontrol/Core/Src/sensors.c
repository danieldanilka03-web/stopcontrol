/**
 ******************************************************************************
 * @file           : sensors.c
 * @brief          : Реализация чтения АЦП и датчиков остановочного павильона
 *                   Проект: StopControl — Мониторинг остановок городского транспорта
 ******************************************************************************
 */

#include "sensors.h"
#include "mpu6050.h"
#include "config.h"

extern uint16_t ADC_ReadChannel(uint8_t channel);
extern bool GPIO_ReadPin(uint32_t port, uint16_t pin);

void Sensors_Init(void) {
    /* Инициализация АЦП1 и калибровка опорного напряжения */
}

/**
 * @brief Пересчёт показаний АЦП фоторезистора в освещённость (Люксы)
 * Схема: VCC (3.3V) -> Фоторезистор GL5528 -> PA0 -> 10 кОм -> GND
 */
uint16_t Sensors_ReadLightLux(void) {
    uint16_t adc_val = ADC_ReadChannel(ADC_CH_LIGHT); /* 12-бит АЦП: 0..4095 */

    if (adc_val == 0) return 0;
    if (adc_val >= 4090) return 2000; /* Яркий солнечный свет */

    /* Расчёт напряжения на делителе */
    float v_out = ((float)adc_val / 4095.0f) * 3.3f;
    /* Сопротивление фоторезистора: R_ldr = (R_ref * (V_cc - V_out)) / V_out */
    float r_ldr = (10000.0f * (3.3f - v_out)) / v_out;

    /* Эмпирическая формула люкс-сопротивления GL5528: Lux = (500 / R_ldr_kOhm) ^ (1 / 0.7) */
    float r_kohm = r_ldr / 1000.0f;
    if (r_kohm < 0.1f) r_kohm = 0.1f;

    float lux = powf((500.0f / r_kohm), 1.4f);
    if (lux > 5000.0f) lux = 5000.0f;

    return (uint16_t)lux;
}

/**
 * @brief Чтение напряжения аккумулятора через резистивный делитель 1:2
 */
float Sensors_ReadBatteryVoltage(void) {
    uint16_t adc_val = ADC_ReadChannel(ADC_CH_BATTERY);
    /* Напряжение: ADC * (3.3 / 4095) * коэффициент делителя 2.0 */
    float v_bat = ((float)adc_val / 4095.0f) * 3.3f * 2.0f;
    return v_bat;
}

/**
 * @brief Полный сбор телеметрических параметров
 */
void Sensors_ReadAll(SensorData_t *data) {
    if (!data) return;

    /* Чтение акселерометра */
    MPU6050_Accel_t acc;
    if (MPU6050_ReadAccel(&acc)) {
        data->accel_x = acc.x;
        data->accel_y = acc.y;
        data->accel_z = acc.z;
        data->total_g = acc.total;
    } else {
        data->total_g = 1.0f; /* Гравитационная единица покоя */
    }

    /* Чтение аналоговых датчиков */
    data->light_lux = Sensors_ReadLightLux();
    data->battery_voltage = Sensors_ReadBatteryVoltage();

    /* Чтение дискретных сигналов */
    data->is_light_powered = GPIO_ReadPin(0, PIN_LIGHT_LINE_SENSE);
    data->glass_sensor_tripped = GPIO_ReadPin(2, PIN_GLASS_SENSOR);
    data->tamper_open = GPIO_ReadPin(2, PIN_TAMPER_SWITCH);
}

/**
 * @brief Проверка аварийной ситуации: ночь, линия освещения под напряжением, но свет не горит
 * @return true, если зафиксирован обрыв или перегорание плафонов
 */
bool Sensors_CheckNightLightingFailure(const SensorData_t *data) {
    if (!data) return false;

    /*
     * Если городская линия питания фонарей активна (is_light_powered == true),
     * но датчик люксометра фиксирует темноту (менее 5 лк внутри павильона) —
     * это свидетельствует об обрыве цепи питания LED-модулей павильона.
     */
    if (data->is_light_powered && (data->light_lux < LIGHT_MIN_NIGHT_LUX)) {
        return true;
    }

    return false;
}
