# Solución Reto 13: Forense — El Tráfico Comprometido (ctf-forensics-pcap)

## Descripción

El archivo `captura_red.pcap` contiene una sesión FTP capturada en la red universitaria. FTP transmite credenciales en **texto plano** — el comando `PASS` envía la contraseña sin cifrar. La flag es la contraseña transmitida.

## Explotación

### Método 1: Wireshark (interfaz gráfica)

1. Descargar `captura_red.pcap` desde la plataforma
2. Abrir con Wireshark
3. En el campo de filtro escribir: `ftp`
4. Buscar el paquete con `PASS` en la columna Info
5. La flag aparece directamente: `PASS CTF{...}`

Alternativa: clic derecho en cualquier paquete FTP → **Follow → TCP Stream** para ver la sesión completa:

```
220 DTIC-FTP v2.1 Ready. Acceso solo para personal autorizado.
USER administrador
331 Contrasena requerida para administrador
PASS CTF{...}
230 Inicio de sesion exitoso.
QUIT
221 Hasta luego.
```

### Método 2: tshark (línea de comandos)

```bash
tshark -r captura_red.pcap -Y "ftp" -T fields -e ftp.request.command -e ftp.request.arg
```

Salida:
```
USER    administrador
PASS    CTF{...}
QUIT
```

O más directo:

```bash
tshark -r captura_red.pcap -Y "ftp.request.command == PASS" -T fields -e ftp.request.arg
```

### Método 3: strings (sin herramientas de red)

```bash
strings captura_red.pcap | grep "CTF{"
```

o

```bash
strings captura_red.pcap | grep "^PASS "
```

## Script de explotación

```python
import re

with open("captura_red.pcap", "rb") as f:
    data = f.read()

match = re.search(rb'PASS (CTF\{[^}]+\})', data)
if match:
    print("Flag:", match.group(1).decode())
```

## Causa raíz

FTP no cifra las comunicaciones. La solución en producción es usar **SFTP** (SSH File Transfer Protocol) o **FTPS** (FTP sobre TLS), que cifran el canal y hacen imposible extraer credenciales de una captura de red.

## Flag

```
CTF{...}   ← comando PASS en el stream FTP de la captura
```
