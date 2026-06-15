# Solución Reto 14: Esteganografía LSB (ctf-stego)

## Descripción

La imagen `documento_aurora7.png` tiene la flag oculta en el **bit menos significativo (LSB)** del canal rojo de cada píxel, en orden de lectura (de izquierda a derecha, de arriba a abajo). Esta técnica modifica visualmente la imagen de forma imperceptible al ojo humano.

El proceso de embedding:
1. Se toma cada carácter de la flag y se convierte a sus 8 bits
2. Cada bit se escribe en el LSB del canal rojo del píxel correspondiente
3. Un byte nulo `\x00` marca el fin del mensaje

## Explotación

### Método 1: Script Python con Pillow

```python
from PIL import Image

img = Image.open("documento_aurora7.png").convert("RGB")
pixels = img.load()
width, height = img.size

bits = []
for y in range(height):
    for x in range(width):
        r, g, b = pixels[x, y]
        bits.append(r & 1)           # extraer LSB del canal rojo

# Agrupar bits en bytes
chars = []
for i in range(0, len(bits) - 7, 8):
    byte = int(''.join(str(b) for b in bits[i:i+8]), 2)
    if byte == 0:                    # byte nulo = fin del mensaje
        break
    chars.append(chr(byte))

print("Mensaje oculto:", ''.join(chars))
```

### Método 2: zsteg (herramienta especializada)

```bash
zsteg documento_aurora7.png
```

Salida relevante:
```
b1,r,lsb,xy    .. text: "CTF{...}"
```

El parámetro `b1,r,lsb,xy` indica: 1 bit, canal rojo, LSB first, orden xy (izquierda-derecha, arriba-abajo).

### Método 3: StegSolve

1. Abrir la imagen en StegSolve
2. Ir a **Analyse → Data Extract**
3. Marcar: Red plane 0 (LSB del rojo), orden Row, Little Endian
4. Clic en **Preview** → el texto de la flag aparece al inicio

### Método 4: steghide / exiftool (negativo)

```bash
exiftool documento_aurora7.png    # muestra metadatos, no contiene la flag
steghide extract -sf documento_aurora7.png   # no usa steghide, fallará
```

Estos métodos no funcionan — la técnica usada es LSB manual, no steghide.

## Script completo (extrae e imprime la flag)

```python
from PIL import Image
import re

img = Image.open("documento_aurora7.png").convert("RGB")
pixels = img.load()
width, height = img.size

bits = [pixels[x, y][0] & 1 for y in range(height) for x in range(width)]

message = []
for i in range(0, len(bits) - 7, 8):
    byte = int(''.join(str(b) for b in bits[i:i+8]), 2)
    if byte == 0:
        break
    message.append(chr(byte))

text = ''.join(message)
match = re.search(r'CTF\{[^}]+\}', text)
if match:
    print("Flag:", match.group())
```

## Causa raíz

La esteganografía LSB no es cifrado — no ofrece confidencialidad real porque cualquier persona con la imagen y conocimiento de la técnica puede extraer el mensaje. Para ocultar información de forma segura se debe combinar con cifrado (cifrar el mensaje antes de embeber).

## Flag

```
CTF{...}   ← LSB del canal rojo de documento_aurora7.png
```
