# Importar datos desde CSV

Clientes, Presupuestos y Proveedores tienen un botón **Importar CSV** (también en Ctrl+K).
El archivo se revisa completo **antes** de cargar nada: si algo no cumple los requisitos,
se muestra fila por fila qué corregir y no se guarda ningún dato.

## Requisitos generales

- Archivo `.csv` en **UTF-8**. En Excel: *Guardar como → CSV UTF-8 (delimitado por comas)*.
- Separador **coma** o **punto y coma** (se detecta solo).
- Máximo **1 MB** y **1000 filas** por archivo.
- La primera fila son los **encabezados**. Valen los nombres de abajo y sus sinónimos; no importan mayúsculas ni acentos.
- No se aceptan columnas que no estén en la lista (evita errores de tipeo).
- Si hay filas con errores, podés corregir el archivo o importar **solo las filas válidas**.
- Cada pantalla tiene **Descargar plantilla** con ejemplos que pasan la validación.

## Clientes (una fila por cliente)

| Columna | Obligatoria | Regla |
|---|---|---|
| `nombre` | sí | 2 a 120 caracteres |
| `rif` | | Letras, números y guiones (3 a 20). No puede repetirse ni existir ya |
| `telefono` | | Números, espacios, `+ - ( )` (6 a 20) |
| `direccion` | | Hasta 200 caracteres |
| `estado` | | `cliente` o `prospecto` (vacío = prospecto) |

Sin RIF, tampoco se aceptan nombres repetidos. No se puede superar el límite de clientes del plan.

## Presupuestos (una fila por ítem)

Las filas con el mismo `numero` forman un presupuesto.

| Columna | Obligatoria | Regla |
|---|---|---|
| `numero` | sí | Entero > 0, que no exista ya |
| `cliente` | sí | RIF o nombre exacto de un cliente ya cargado |
| `fecha` | sí | `DD/MM/AAAA` o `AAAA-MM-DD` |
| `moneda` | | `$`, `Bs` o `€` (vacío = $) |
| `estado` | | `borrador`, `enviado`, `aprobado` o `rechazado` (vacío = borrador) |
| `producto` | sí | Hasta 200 caracteres |
| `cantidad` | sí | Entero > 0 |
| `precio_unitario` | sí | ≥ 0; acepta `1234,56`, `1.234,56` o `1234.56` |

- Todas las filas de un mismo número deben coincidir en cliente, fecha, moneda y estado.
- Si un ítem tiene un error, se descarta **el presupuesto completo** (nunca se carga a medias).
- Máximo 100 ítems por presupuesto y no se puede superar el límite mensual del plan.

## Proveedores (una fila por proveedor)

| Columna | Obligatoria | Regla |
|---|---|---|
| `razon_social` | sí | 2 a 150 caracteres |
| `nombre_fantasia` | | Hasta 150 |
| `cuit` | | Letras, números y guiones (3 a 20). No puede repetirse ni existir ya |
| `categoria` | | Hasta 60 |
| `notas` | | Hasta 1000 |

## Cómo está hecho

- `frontend/src/lib/csv/parse.ts`: parser RFC 4180 (comillas, saltos de línea dentro de celdas, BOM, detección de separador).
- `frontend/src/lib/csv/engine.ts`: validación genérica (requisitos del archivo, columnas, errores por fila y columna).
- `frontend/src/lib/csv/definitions/*`: reglas de cada módulo.
- `frontend/src/lib/csv/importers.ts`: lee lo existente (paginado) para detectar duplicados y límites, e inserta en bloques de 100 (los presupuestos, de a uno con sus ítems).
- La base sigue siendo la última barrera: RLS por empresa, restricciones de columnas, número único y límites del plan por trigger.
