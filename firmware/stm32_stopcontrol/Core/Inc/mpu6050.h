/**
 ******************************************************************************
 * @file           : mpu6050.h
 * @brief          : Драйвер 6-осевого датчика ускорения и удара MPU-6050
 *                   Проект: StopControl — Мониторинг остановок городского транспорта
 ******************************************************************************
 */

#ifndef __MPU6050_H__
#define __MPU6050_H__

#include <stdint.h>
#include <stdbool.h>

/* I2C-адрес устройства (AD0 подтянут к GND) */
#define MPU6050_I2C_ADDR        (0x68 << 1)

/* Регистры датчика MPU6050 */
#define MPU6050_REG_SMPLRT_DIV      0x19
#define MPU6050_REG_CONFIG          0x1A
#define MPU6050_REG_GYRO_CONFIG     0x1B
#define MPU6050_REG_ACCEL_CONFIG    0x1C
#define MPU6050_REG_INT_PIN_CFG     0x37
#define MPU6050_REG_INT_ENABLE      0x38
#define MPU6050_REG_INT_STATUS      0x3A
#define MPU6050_REG_ACCEL_XOUT_H    0x3B
#define MPU6050_REG_PWR_MGMT_1      0x6B
#define MPU6050_REG_PWR_MGMT_2      0x6C
#define MPU6050_REG_WHO_AM_I        0x75

/* Диапазон акселерометра: ±8g (чувствительность 4096 LSB/g) */
#define ACCEL_SCALE_FACTOR_8G       4096.0f

typedef struct {
    float x;
    float y;
    float z;
    float total;
} MPU6050_Accel_t;

/* Функции драйвера */
bool MPU6050_Init(void);
bool MPU6050_ReadAccel(MPU6050_Accel_t *accel);
bool MPU6050_ConfigureWakeOnMotion(uint8_t threshold_lsb);
bool MPU6050_SelfTest(void);

#endif /* __MPU6050_H__ */
