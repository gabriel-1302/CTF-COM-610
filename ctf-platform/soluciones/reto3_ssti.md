# Solución Reto 3: Server-Side Template Injection (SSTI Jinja2)

## Descripción
Este reto expone una vulnerabilidad de Server-Side Template Injection (SSTI) en una aplicación web basada en Flask. El endpoint `/hello?name=` toma el parámetro `name` suministrado por el usuario y lo formatea directamente dentro de una cadena que luego es evaluada por el motor de plantillas Jinja2, utilizando la función `render_template_string()`.

El uso de un *f-string* de Python para inyectar variables en la plantilla antes de que esta sea procesada por el motor, permite que la entrada del usuario sea interpretada como directivas activas de la plantilla en lugar de texto estático.

## Pasos para la Explotación

### 1. Comprobación de la Vulnerabilidad (Sanity Check)
Para verificar que el motor de plantillas está interpretando y evaluando nuestra entrada, inyectamos una operación matemática básica encerrada en la sintaxis de evaluación de variables de Jinja2 (`{{ ... }}`).

**Payload de comprobación:**
```text
{{7*7}}
```
*Si la vulnerabilidad existe, el servidor responderá con el resultado matemático evaluado, devolviendo la cadena `Hello, 49!` en lugar de la cadena literal.*

### 2. Ejecución de Código Remoto (RCE)
Una vez confirmada la vulnerabilidad de SSTI en Jinja2, el objetivo es conseguir Ejecución de Comandos (Remote Code Execution - RCE) en el sistema para leer el archivo que contiene la flag, el cual sabemos que se encuentra en la ruta `/flag.txt`.

En Jinja2, podemos acceder al entorno subyacente de Python escapando del contexto de la plantilla utilizando clases integradas que exponen el entorno global, como por ejemplo el módulo `os`.

**Payload de RCE:**
```python
{{ cycler.__init__.__globals__.os.popen('cat /flag.txt').read() }}
```

### 3. Explicación del Payload
* `cycler`: Es un objeto auxiliar disponible globalmente por defecto en el contexto de las plantillas de Jinja2.
* `.__init__`: Accede al método inicializador de la clase `cycler`.
* `.__globals__`: Accede al diccionario global de variables y módulos disponibles donde se definió la clase, lo que nos otorga acceso directo a módulos de la librería estándar de Python que Jinja utiliza internamente (como el módulo `os`).
* `.os.popen('cat /flag.txt').read()`: Llama al módulo `os` para ejecutar el comando bash `cat /flag.txt` en el sistema operativo contenedor y luego lee la salida resultante de dicho comando.

Al enviar este payload en el parámetro `name` (`/hello?name={{cycler...}}`), la aplicación procesará la instrucción y devolverá el contenido exacto del archivo de la flag incrustado en su respuesta HTML.
