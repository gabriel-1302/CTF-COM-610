# Solución Reto 2: Stored XSS ("El Libro de Visitas")

## Descripción
Este reto simula un "Libro de Visitas" donde los usuarios pueden publicar mensajes para la comunidad. La aplicación recibe los mensajes en el backend y los almacena directamente sin sanitización ni validación. Luego, en el frontend, se recuperan estos mensajes y se inyectan en el DOM de forma insegura utilizando `innerHTML`. Esto habilita una vulnerabilidad de Cross-Site Scripting (XSS) Almacenado o Persistente.

El reto cuenta con un bot administrador (usando Puppeteer) que simula a un usuario real revisando los comentarios cada 30 segundos. Este bot cuenta con una cookie activa y muy valiosa: la flag del reto.

## Pasos para la Explotación

### 1. Identificación y Evasión
Al tratar de inyectar etiquetas directas como `<script>alert(1)</script>`, la inyección ocurre en el DOM gracias al `innerHTML`, pero por protección nativa de HTML5 los scripts directos insertados de esta forma no se ejecutan automáticamente. 

Para lograr la ejecución de código (RCE a nivel de navegador), debemos recurrir a vectores basados en atributos de eventos de otras etiquetas HTML, tales como el evento `onerror` en la etiqueta de imagen `<img>`.

### 2. Construcción del Payload de Exfiltración
El objetivo es diseñar un payload que:
1. Se ejecute silenciosamente en el navegador del administrador (bot).
2. Lea el valor de su `document.cookie` (donde reside la flag).
3. Exfiltre ese valor hacia nosotros.

En lugar de utilizar un servidor externo (webhook), podemos aprovechar la propia mecánica del "Libro de Visitas" para lograr la exfiltración. Programamos el payload para que utilice la API `fetch` nativa del navegador, la cual realizará una solicitud `POST /comment` en nombre del bot, publicando un nuevo comentario cuyo texto sea precisamente su propia cookie.

**Payload:**
```html
<img src="x" onerror="fetch('/comment', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'content=' + encodeURIComponent(document.cookie)})">
```

### 3. Explotación Final
1. En la caja de texto del libro de visitas, introducimos el payload indicado y seleccionamos **Publicar comentario**.
2. Nuestro navegador tratará de cargar una imagen apuntando al recurso inexistente (`x`). Al fallar, saltará al bloque `onerror`, pero en nuestro caso sólo enviará nuestra cookie local (sin interés).
3. Dentro del lapso de 30 segundos, el bot administrador automático visitará la página cargando todos los comentarios.
4. El navegador del bot interpretará la etiqueta `<img>` rota y disparará **su** evento `onerror`.
5. Esto ejecuta la petición silenciosa y postea un nuevo comentario de parte del bot.
6. Esperamos unos instantes en la página principal y veremos aparecer mágicamente un nuevo comentario en la lista, el cual revelará la cookie del administrador:

**Resultado visualizado:**
```text
role=admin; flag=CTF{9a81987d9a751cc7a46b5b48aa4b2b6a}
```
