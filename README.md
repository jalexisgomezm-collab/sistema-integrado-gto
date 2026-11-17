# Sistema Integrado GTO PERÚ — Menú principal

Página de inicio que reúne los sistemas de GTO PERÚ S.A.C. Sitio estático (HTML + imágenes), sin base de datos ni claves.

## Sistemas enlazados
| Sistema | Dirección |
|---|---|
| Sistema de Cotizaciones | https://cotizador-gto-web.vercel.app |
| Maestro de Gestión de Operaciones | https://maestro-gestion-operaciones.vercel.app |
| Logística y Compras | https://gto-oc-sistema-app.vercel.app |
| Bitácora Técnica (Laboratorio y Taller) | https://bitacora-tecnica-gto.vercel.app |
| Recursos Humanos | https://gto-rrhh.vercel.app |
| GTO Finanzas | https://gto-finanzas.vercel.app |

## Cambiar o agregar un sistema
En `index.html`, buscar `const SISTEMAS = [` y editar o copiar un bloque `{ ... }`:
`nombre`, `codigo`, `desc`, `funciones`, `acceso` y `url`. Si `url` queda vacío, la tarjeta aparece como "Por configurar".
Iconos disponibles: `cot`, `maestro`, `logistica`, `bitacora`, `rrhh`, `finanzas`.

## Publicación
Repositorio en GitHub conectado a Vercel: cada cambio en la rama `main` se publica solo.
Cada sistema mantiene su propio inicio de sesión; este menú no guarda usuarios ni datos.
