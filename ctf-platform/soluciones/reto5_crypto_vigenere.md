# Solución Reto 5: Cifrado Clásico ("El Cifrado Perfecto")

## Descripción
Este reto se enmarca en criptografía clásica, utilizando el histórico Cifrado de Vigenère. La aplicación oculta la flag dentro de un extenso texto en claro (un texto largo de aproximadamente 2242 caracteres) que luego es cifrado enteramente utilizando una clave repetitiva muy corta: la palabra `BEACON` (6 caracteres).

La vulnerabilidad reside en la reutilización de una clave estática muy pequeña para cifrar un texto extremadamente extenso. La repetición debilita el cifrado y permite la ruptura del algoritmo mediante técnicas de criptoanálisis estadístico clásico.

## Pasos para la Explotación

### 1. Determinación de la Longitud de la Clave
El primer paso lógico es averiguar la longitud precisa de la clave empleada. Esto se logra evaluando el Índice de Coincidencia (IoC - Index of Coincidence). 

Al procesar el texto cifrado completo, un IoC cercano a `0.065` (valor estadístico normal para idiomas occidentales no cifrados) en intervalos periódicos sugiere que cada *N-ésima* letra fue desplazada en el abecedario por la misma cantidad. En este caso particular, al agrupar las letras cada 6 posiciones, se revelará un IoC alto, confirmando empíricamente que la longitud de la clave original es **6**.

*(Alternativamente, se puede aplicar el Método Kasiski, buscando patrones repetidos en el texto cifrado, lo cual indicaría distancias de repetición que resultarían ser casi todas múltiplos de 6).*

### 2. Análisis Estadístico de Frecuencias por Columna
Una vez averiguada la longitud exacta (6), el texto cifrado se puede dividir lógicamente en 6 "columnas" o grupos distintos. Cada grupo representa una serie de letras del texto original que han sido cifradas utilizando exclusivamente la misma letra de la clave. Es decir, cada columna se comporta ahora como un texto cifrado con el Cifrado César clásico.

Dado que sabemos que el texto original está en lenguaje natural, la letra 'E' será con creces la letra estadísticamente más frecuente (rondando un 13% de apariciones).
El proceso para cada una de las 6 columnas es idéntico:
1. Se cuenta exhaustivamente la frecuencia de cada letra en la columna.
2. Se asume estadísticamente que la letra más frecuente de ese grupo corresponde a la letra 'E' oculta del texto plano original.
3. Se calcula el desplazamiento matemático en el alfabeto requerido para transmutar esa letra de regreso hacia la supuesta 'E'.
4. Este desplazamiento revela inequívocamente la letra de la clave correspondiente a la posición de esa columna.

### 3. Recuperación Total de la Clave y Descifrado
Al automatizar y repetir este proceso estadístico para las 6 columnas, descubrimos que los desplazamientos numéricos corresponden exactamente a las letras de la palabra clave: **`BEACON`**.

Una vez conocida la clave, el cifrado de Vigenère se puede revertir con cualquier herramienta en línea o script aplicando la clave estática a lo largo de todo el texto.

### 4. Automatización a través del Endpoint
Como un atajo amigable que provee el desarrollador del reto, la aplicación expone un endpoint `/decrypt` que, validando recibir la clave correcta, hace el trabajo de transformación final por nosotros.

**Petición POST de Validación:**
```bash
curl -X POST http://localhost:<PUERTO_INSTANCIA>/decrypt \
  -H "Content-Type: application/json" \
  -d '{"key": "BEACON"}'
```
*Al inyectar la palabra clave descubierta, el servidor validará la longitud y retornará el texto literario original íntegro descifrado. Al examinar cuidadosamente su interior, encontraremos la flag del reto incrustada en formato hexadecimal mayúscula (p.ej. `CTF{...}`).*
