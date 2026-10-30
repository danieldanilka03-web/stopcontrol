/**
 ******************************************************************************
 * @file           : mpu6050.c
 * @brief          : Реализация драйвера акселерометра MPU6050 через шину I2C1
 *                   Проект: StopControl — Мониторинг остановок городского транспорта
 ******************************************************************************
 */

#include "mpu6050.h"
#include <math.h>
#include <stdio.h>

/* Прототипы низкоуровневых I2C-операций (HAL / CMSIS эмуляция) */
extern bool I2C_WriteReg(uint8_t dev_addr, uint8_t reg, uint8_t data);
extern bool I2C_ReadRegs(uint8_t dev_addr, uint8_t reg, uint8_t *buf, uint16_t len);
extern void Delay_Ms(uint32_t ms);

/**
 * @brief Инициализация сенсора MPU-6050
 * @return true при успешном ответе по WHO_AM_I
 */
bool MPU6050_Init(void) {
    uint8_t who_am_i = 0;

    /* Проверка отклика микросхемы (должно вернуться 0x68) */
    if (!I2C_ReadRegs(MPU6050_I2C_ADDR, MPU6050_REG_WHO_AM_I, &who_am_i, 1)) {
        return false;
    }
    if (who_am_i != 0x68) {
        return false;
    }

    /* Вывод из спящего режима (Сброс SLEEP бита в PWR_MGMT_1, тактирование от гироскопа X) */
    if (!I2C_WriteReg(MPU6050_I2C_ADDR, MPU6050_REG_PWR_MGMT_1, 0x01)) {
        return false;
    }
    Delay_Ms(10);

    /* Конфигурация фильтра низких частот (DLPF: 44 Hz) */
    I2C_WriteReg(MPU6050_I2C_ADDR, MPU6050_REG_CONFIG, 0x03);

    /* Частота дискретизации: 1kHz / (1 + 9) = 100 Hz */
    I2C_WriteReg(MPU6050_I2C_ADDR, MPU6050_REG_SMPLRT_DIV, 0x09);

    /* Настройка диапазона акселерометра ±8g (FS_SEL = 2) */
    I2C_WriteReg(MPU6050_I2C_ADDR, MPU6050_REG_ACCEL_CONFIG, 0x10);

    /* Настройка пина прерывания INT: активный высокий уровень, push-pull, защёлка до чтения */
    I2C_WriteReg(MPU6050_I2C_ADDR, MPU6050_REG_INT_PIN_CFG, 0x20);

    return true;
}

/**
 * @brief Чтение ускорений по трём осям и вычисление модуля перегрузки
 */
bool MPU6050_ReadAccel(MPU6050_Accel_t *accel) {
    uint8_t raw[6];

    if (!accel) return false;

    /* Читаем 6 байт начиная с ACCEL_XOUT_H */
    if (!I2C_ReadRegs(MPU6050_I2C_ADDR, MPU6050_REG_ACCEL_XOUT_H, raw, 6)) {
        return false;
    }

    int16_t raw_x = (int16_t)((raw[0] << 8) | raw[1]);
    int16_t raw_y = (int16_t)((raw[2] << 8) | raw[3]);
    int16_t raw_z = (int16_t)((raw[4] << 8) | raw[5]);

    /* Перевод дискрет в единицы свободного падения g */
    accel->x = (float)raw_x / ACCEL_SCALE_FACTOR_8G;
    accel->y = (float)raw_y / ACCEL_SCALE_FACTOR_8G;
    accel->z = (float)raw_z / ACCEL_SCALE_FACTOR_8G;

    /* Результирующий вектор |G| = sqrt(x^2 + y^2 + z^2) */
    accel->total = sqrtf(accel->x * accel->x +
                         accel->y * accel->y +
                         accel->z * accel->z);

    return true;
}

/**
 * @brief Активация аппаратного прерывания Wake-On-Motion
 * @param threshold_lsb Порог детекции движения (1 LSB = 32mg)
 */
bool MPU6050_ConfigureWakeOnMotion(uint8_t threshold_lsb) {
    /* Запись порога движения */
    I2C_WriteReg(MPU6050_I2C_ADDR, 0x1F, threshold_lsb); /* MOT_THR */
    I2C_WriteReg(MPU6050_I2C_ADDR, 0x20, 0x01);          /* MOT_DUR: 1ms */

    /* Включение прерывания движения в регистре INT_ENABLE (Бит 6: MOT_EN) */
    return I2C_WriteReg(MPU6050_I2C_ADDR, MPU6050_REG_INT_ENABLE, 0x40);
}
