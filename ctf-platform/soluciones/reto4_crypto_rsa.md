# Solución Reto 4: RSA de Exponente Pequeño ("Claves Rotas")

## Descripción
Este reto se centra en la criptografía asimétrica, específicamente en una mala implementación matemática del algoritmo RSA. La aplicación genera un par de claves RSA donde el exponente público $e$ tiene un valor extremadamente pequeño ($e=3$). Además, el mensaje a cifrar (que contiene la flag, $m$) es relativamente corto y no se utiliza ningún esquema de relleno aleatorio seguro (como OAEP).

Bajo estas particulares condiciones combinadas, cuando se cifra el mensaje ($c = m^e \pmod n$), resulta que el valor matemático de $m^3$ es menor que el módulo $n$ ($m^3 < n$). 

## Pasos para la Explotación

### 1. Análisis de la Vulnerabilidad
En un cifrado RSA normal y seguro, el texto cifrado se calcula como:
$$c = m^e \pmod n$$

Al ser $e=3$ y garantizarse matemáticamente que $m^3 < n$, la operación de reducción de módulo $\pmod n$ nunca llega a actuar ni a limitar el número, por lo que el cifrado RSA se degrada a una simple potenciación cúbica estándar:
$$c = m^3$$

Por lo tanto, recuperar el texto claro $m$ es tan sencillo como calcular la raíz cúbica entera del texto cifrado $c$, ignorando por completo el módulo $n$ y sin requerir factorizarlo (que es donde reside la seguridad matemática de RSA).

### 2. Extracción de Datos
Para resolver el reto, necesitamos descargar los parámetros públicos y el texto cifrado desde la API REST de la instancia:
1. Acceder al endpoint `/pubkey` para extraer el módulo $n$ y el exponente público $e$ (comprobando que es 3).
2. Acceder al endpoint `/challenge` para obtener el texto cifrado $c$ devuelto en formato hexadecimal.

### 3. Ejecución y Script de Solución
Dado que el texto cifrado $c$ es un número entero gigantesco, utilizar la función de raíz cúbica con punto flotante nativa de un lenguaje (por ejemplo en Python `** (1/3)`) perderá precisión, devolviendo un valor entero incorrecto y corrompiendo la flag. Se requiere una función de búsqueda binaria exacta para enteros grandes o librerías optimizadas de terceros (como `gmpy2`).

**Script de Solución (Python con Búsqueda Binaria Pura):**
```python
import json
import requests
from Crypto.Util.number import long_to_bytes

def integer_cbrt(n):
    """Calcula la raíz cúbica entera exacta utilizando búsqueda binaria sobre enteros enormes."""
    low = 0
    high = n
    while low < high:
        mid = (low + high) // 2
        if mid**3 < n:
            low = mid + 1
        else:
            high = mid
    return low

# Reemplaza la URL con la dirección expuesta de tu instancia instanciada
URL = "http://localhost:<PUERTO_INSTANCIA>"

# 1. Obtener los datos expuestos del reto
response = requests.get(f"{URL}/challenge").json()
c_hex = response['ciphertext_hex']
c_int = int(c_hex, 16) # Convertir el texto cifrado de hex a entero base 10

# 2. Calcular la raíz cúbica matemática exacta de c
m_int = integer_cbrt(c_int)

# 3. Convertir el número entero grande resultante de vuelta a bytes ascii para obtener la flag
flag = long_to_bytes(m_int).decode()
print("Flag obtenida con éxito:", flag)
```
*Al ejecutar este script contra la instancia, la raíz cúbica devolverá el texto íntegro en texto plano exponiendo la flag.*
