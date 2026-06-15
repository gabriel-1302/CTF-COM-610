# Solución Reto 1: SQL Injection (ctf-sqli)

## Descripción
El reto consiste en un formulario de inicio de sesión vulnerable a inyección SQL (SQLi). El backend está construido en Flask y la vulnerabilidad radica en la concatenación directa de cadenas de texto (uso de f-strings en Python sin parametrizar) en la consulta SQL del endpoint `/login`.

## Pasos para la Explotación

### 1. Bypass de Autenticación
Para verificar que el campo es vulnerable y lograr saltarnos la autenticación principal, inyectamos un payload en el campo de nombre de usuario. Introducimos una comilla simple (`'`) para romper y cerrar la consulta original, seguida de una condición booleana que siempre se evaluará como verdadera (`OR '1'='1'`) y finalmente comentamos el resto de la consulta original para evitar errores de sintaxis en el gestor de base de datos (`-- `).

**Payload de Bypass:**
```sql
' OR '1'='1' --
```
*Al ingresar esto en el campo de usuario y escribir cualquier texto aleatorio en la contraseña, el sistema evaluará la condición como verdadera y lograremos iniciar sesión exitosamente evadiendo el control de acceso.*

### 2. Exfiltración de la Flag (UNION SELECT)
Sabiendo que existe la vulnerabilidad y conociendo o infiriendo la estructura de la base de datos (por ejemplo, asumiendo la existencia de una tabla `flags`), podemos extraer información adicional del sistema.

Utilizamos el operador `UNION` para combinar los resultados de la consulta de autenticación original con los de una nueva consulta maliciosa (nuestro `SELECT`).

**Payload de Extracción:**
```sql
' UNION SELECT null, flag, null FROM flags --
```
*(Nota: El número exacto de columnas, representadas aquí como `null`, debe coincidir con el número de columnas que devuelve el `SELECT` de la consulta original del sistema).*

Al enviar este payload en el campo vulnerable, la base de datos ejecuta el `UNION` y el backend retornará los datos extraídos de la tabla secreta `flags`, mostrando así la respuesta final por pantalla y resolviendo el reto.
